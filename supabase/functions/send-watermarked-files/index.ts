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

    const attachments = [];

    for (const fileId of fileIds) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("pdf-files")
        .download(fileId);

      if (downloadError) {
        console.error("Error downloading file:", downloadError);
        continue;
      }

      const fileName = fileId.split('/').pop() || 'document.pdf';
      const fileBuffer = await fileData.arrayBuffer();
      const base64Content = btoa(
        new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      attachments.push({
        filename: fileName,
        content: base64Content,
        encoding: "base64",
      });
    }

    const emailResponse = await resend.emails.send({
      from: "Watermark System <onboarding@resend.dev>",
      to: [email],
      subject: "קבצי PDF מוטמעים שלך",
      html: `
        <div dir="rtl">
          <h1>הקבצים המוטמעים שלך מוכנים!</h1>
          <p>שלום,</p>
          <p>צירפנו ${attachments.length} קבצי PDF מוטמעים למייל זה.</p>
          <p>בברכה,<br>מערכת ההטמעה</p>
        </div>
      `,
      attachments: attachments,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
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