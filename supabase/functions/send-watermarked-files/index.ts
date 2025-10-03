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

    // Build signed download links instead of attaching files to avoid memory limits
    const links: { name: string; url: string }[] = [];

    for (const fileId of fileIds) {
      try {
        // Derive final (Hebrew) file name
        const processedFileName = fileId.split('/').pop() || 'document.pdf';
        const fileNameWithoutUserId = processedFileName.replace(/_[^_]+\.pdf$/, '.pdf');
        const { data: templateData } = await supabase
          .from('pdf_templates')
          .select('name, file_path')
          .ilike('file_path', `%${fileNameWithoutUserId}%`)
          .maybeSingle();

        let finalFileName = processedFileName;
        if (templateData?.name) {
          const userId = processedFileName.match(/_([^_]+)\.pdf$/)?.[1] || '';
          const originalNameWithoutExt = templateData.name.replace(/\.pdf$/i, '');
          finalFileName = userId ? `${originalNameWithoutExt}_${userId}.pdf` : templateData.name;
        }

        // Create a signed URL valid for 3 days
        const { data: signed, error: signedError } = await supabase.storage
          .from('pdf-files')
          .createSignedUrl(fileId, 60 * 60 * 24 * 3);
        if (signedError || !signed?.signedUrl) {
          console.error('Error creating signed URL for', fileId, signedError);
          continue;
        }

        // Ensure the URL is absolute
        const signedUrl = signed.signedUrl.startsWith('http') 
          ? signed.signedUrl 
          : `${Deno.env.get("SUPABASE_URL")}/storage/v1${signed.signedUrl}`;

        links.push({ name: finalFileName, url: signedUrl });
      } catch (err) {
        console.error('Error preparing link for', fileId, err);
      }
    }

    if (links.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No files available to send' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const listItems = links
      .map((l) => {
        const courseName = l.name.replace(/_\d+\.pdf$/, '').replace(/\.pdf$/i, '');
        return `<p style="margin: 8px 0;">• <a href="${l.url}" style="color: #0066cc; text-decoration: none;">${courseName}</a></p>`;
      })
      .join('');

    const emailResponse = await resend.emails.send({
      from: 'Watermark System <onboarding@resend.dev>',
      to: [email],
      subject: 'קבצים מהקורס',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
          <p style="margin-bottom: 16px;">שלום,</p>
          <p style="margin-bottom: 16px;">מצורפים הקבצים שלך בקורס הרלוונטי, על הקבצים מוטמעים הפרטים האישיים שלך, והם לשימוש אישי בלבד. כל שיתוף או העתקה של הקבצים יהווה הפרה של זכויות יוצרים ועלול לגרור השלכות.</p>
          <p style="margin-bottom: 12px; margin-top: 20px;"><strong>קבצים להורדה (זמינים ל-3 ימים):</strong></p>
          <div style="margin-right: 20px;">
            ${listItems}
          </div>
          <p style="margin-top: 20px;">בהצלחה!</p>
        </div>
      `,
    });

    console.log('Email with links sent successfully:', emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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