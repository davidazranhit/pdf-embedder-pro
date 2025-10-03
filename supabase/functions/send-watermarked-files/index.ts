import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  email: string;
  fileIds: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const resend = new Resend(apiKey);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (!apiKey) {
      console.error("Missing RESEND_API_KEY secret");
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY. Create one at https://resend.com/api-keys and add it as RESEND_API_KEY secret." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { email, fileIds }: SendEmailRequest = await req.json();
    console.log("Sending files to:", email, "Files:", fileIds);

    // Batch attachments to avoid provider limits (size/count)
    const MAX_TOTAL_BYTES = 20_000_000; // ~20MB safety limit
    const MAX_FILES_PER_EMAIL = 10;     // safety cap

    const attachments: Array<{ filename: string; content: string; contentType: string; size: number }>[] = [];
    let currentBatch: Array<{ filename: string; content: string; contentType: string; size: number }> = [];
    let currentBatchSize = 0;

    for (const fileId of fileIds) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("pdf-files")
        .download(fileId);

      if (downloadError) {
        console.error("Error downloading file:", downloadError);
        continue;
      }

      // Extract the processed file name to get the userId suffix
      const processedFileName = fileId.split('/').pop() || 'document.pdf';
      
      // Get the original file path from the processed file name
      // Format: originalname_userId.pdf -> we need to find the original template
      const fileNameWithoutUserId = processedFileName.replace(/_[^_]+\.pdf$/, '.pdf');
      
      // Query the database to get the original name
      const { data: templateData } = await supabase
        .from('pdf_templates')
        .select('name, file_path')
        .ilike('file_path', `%${fileNameWithoutUserId}%`)
        .maybeSingle();
      
      // Use original name with userId suffix for the email attachment
      let finalFileName = processedFileName;
      if (templateData?.name) {
        const userId = processedFileName.match(/_([^_]+)\.pdf$/)?.[1] || '';
        const originalNameWithoutExt = templateData.name.replace(/\.pdf$/i, '');
        finalFileName = userId ? `${originalNameWithoutExt}_${userId}.pdf` : templateData.name;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const byteLength = arrayBuffer.byteLength;
      const base64Content = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // If adding this file would exceed limits, start a new batch
      const wouldExceedSize = currentBatchSize + byteLength > MAX_TOTAL_BYTES;
      const wouldExceedCount = currentBatch.length + 1 > MAX_FILES_PER_EMAIL;
      if (currentBatch.length > 0 && (wouldExceedSize || wouldExceedCount)) {
        attachments.push(currentBatch);
        currentBatch = [];
        currentBatchSize = 0;
      }

      currentBatch.push({ filename: finalFileName, content: base64Content, contentType: "application/pdf", size: byteLength });
      currentBatchSize += byteLength;
    }

    if (currentBatch.length > 0) {
      attachments.push(currentBatch);
    }

    const sendResults = [] as any[];
    for (let i = 0; i < attachments.length; i++) {
      const batch = attachments[i];
      const emailResponse = await resend.emails.send({
        from: "Watermark System <onboarding@resend.dev>",
        to: [email],
        subject: "קבצים",
        html: `
          <div dir="rtl">
            <p>הקבצים המוטמעים שלך מצורפים, שמור על הקבצים לשימוש אישי בלבד ואל תשתף אותם</p>
            ${attachments.length > 1 ? `<p>מייל ${i + 1} מתוך ${attachments.length}</p>` : ''}
          </div>
        `,
        attachments: batch.map(({ size, ...rest }) => rest),
      });
      console.log(`Email batch ${i + 1}/${attachments.length} sent:`, emailResponse);
      sendResults.push(emailResponse);
    }

    return new Response(JSON.stringify({ success: true, results: sendResults, emailResponse: sendResults[0] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in send-watermarked-files:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});