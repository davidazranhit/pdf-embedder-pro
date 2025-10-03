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

    // Process files in smaller batches to avoid memory limits
    const MAX_BATCH_SIZE = 8_000_000;  // 8MB per email (conservative for edge functions)
    const MAX_FILES_PER_BATCH = 3;      // Process only 3 files at a time
    
    const sendResults = [] as any[];
    let batchNumber = 0;
    
    // Process files one by one, grouping into small batches
    for (let i = 0; i < fileIds.length; i += MAX_FILES_PER_BATCH) {
      const batchFileIds = fileIds.slice(i, i + MAX_FILES_PER_BATCH);
      const attachments = [];
      let batchSize = 0;

      for (const fileId of batchFileIds) {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from("pdf-files")
            .download(fileId);

          if (downloadError) {
            console.error("Error downloading file:", downloadError);
            continue;
          }

          // Extract the processed file name
          const processedFileName = fileId.split('/').pop() || 'document.pdf';
          const fileNameWithoutUserId = processedFileName.replace(/_[^_]+\.pdf$/, '.pdf');
          
          // Query the database for original name
          const { data: templateData } = await supabase
            .from('pdf_templates')
            .select('name, file_path')
            .ilike('file_path', `%${fileNameWithoutUserId}%`)
            .maybeSingle();
          
          // Build final file name with original Hebrew name + userId
          let finalFileName = processedFileName;
          if (templateData?.name) {
            const userId = processedFileName.match(/_([^_]+)\.pdf$/)?.[1] || '';
            const originalNameWithoutExt = templateData.name.replace(/\.pdf$/i, '');
            finalFileName = userId ? `${originalNameWithoutExt}_${userId}.pdf` : templateData.name;
          }

          const arrayBuffer = await fileData.arrayBuffer();
          const byteLength = arrayBuffer.byteLength;
          
          // Skip files that would exceed batch size limit alone
          if (byteLength > MAX_BATCH_SIZE) {
            console.warn(`File ${finalFileName} too large (${byteLength} bytes), skipping`);
            continue;
          }
          
          // If adding this file would exceed batch size, send current batch first
          if (batchSize + byteLength > MAX_BATCH_SIZE && attachments.length > 0) {
            batchNumber++;
            const totalBatches = Math.ceil(fileIds.length / MAX_FILES_PER_BATCH);
            const emailResponse = await resend.emails.send({
              from: "Watermark System <onboarding@resend.dev>",
              to: [email],
              subject: "קבצים",
              html: `
                <div dir="rtl">
                  <p>הקבצים המוטמעים שלך מצורפים, שמור על הקבצים לשימוש אישי בלבד ואל תשתף אותם</p>
                  ${totalBatches > 1 ? `<p>חלק ${batchNumber} מתוך ${totalBatches}</p>` : ''}
                </div>
              `,
              attachments: attachments,
            });
            console.log(`Batch ${batchNumber} sent:`, emailResponse);
            sendResults.push(emailResponse);
            
            // Reset for next batch
            attachments.length = 0;
            batchSize = 0;
          }

          // Convert to base64 and add to current batch
          const base64Content = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          attachments.push({
            filename: finalFileName,
            content: base64Content,
            contentType: "application/pdf",
          });
          batchSize += byteLength;
          
        } catch (error) {
          console.error(`Error processing file ${fileId}:`, error);
        }
      }

      // Send remaining attachments in this batch
      if (attachments.length > 0) {
        batchNumber++;
        const totalBatches = Math.ceil(fileIds.length / MAX_FILES_PER_BATCH);
        const emailResponse = await resend.emails.send({
          from: "Watermark System <onboarding@resend.dev>",
          to: [email],
          subject: "קבצים",
          html: `
            <div dir="rtl">
              <p>הקבצים המוטמעים שלך מצורפים, שמור על הקבצים לשימוש אישי בלבד ואל תשתף אותם</p>
              ${totalBatches > 1 ? `<p>חלק ${batchNumber} מתוך ${totalBatches}</p>` : ''}
            </div>
          `,
          attachments: attachments,
        });
        console.log(`Batch ${batchNumber} sent:`, emailResponse);
        sendResults.push(emailResponse);
      }
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