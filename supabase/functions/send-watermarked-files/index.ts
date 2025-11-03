import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const apiKey = Deno.env.get("BREVO_API_KEY") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (!apiKey) {
      console.error("Missing BREVO_API_KEY secret");
      return new Response(
        JSON.stringify({ error: "Missing BREVO_API_KEY. Create one at https://app.brevo.com/settings/keys/api and add it as BREVO_API_KEY secret." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { email, fileIds }: SendEmailRequest = await req.json();
    console.log("Sending files to:", email, "Files:", fileIds);

    // Build signed download links instead of attaching files to avoid memory limits
    const links: { name: string; url: string }[] = [];

    for (const fileId of fileIds) {
      try {
        // Derive final (Hebrew) file name with userId from processed filename
        const processedFileName = fileId.split('/').pop() || 'document.pdf';
        const fileNameWithoutUserId = processedFileName.replace(/_[^_]+\.pdf$/, '.pdf');
        const userIdFromFile = processedFileName.match(/_([^_]+)\.pdf$/)?.[1] || '';
        
        const { data: templateData } = await supabase
          .from('pdf_templates')
          .select('name, file_path')
          .ilike('file_path', `%${fileNameWithoutUserId}%`)
          .maybeSingle();

        let finalFileName = processedFileName;
        if (templateData?.name) {
          const originalNameWithoutExt = templateData.name.replace(/\.pdf$/i, '');
          finalFileName = userIdFromFile ? `${originalNameWithoutExt}${userIdFromFile}.pdf` : templateData.name;
        } else if (userIdFromFile) {
          // For uploaded files without template match, add userId directly without underscore
          const nameWithoutExt = processedFileName.replace(/_[^_]+\.pdf$/i, '').replace(/\.pdf$/i, '');
          finalFileName = `${nameWithoutExt}${userIdFromFile}.pdf`;
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
        const courseName = l.name.replace(/\d+\.pdf$/i, '').replace(/\.pdf$/i, '');
        return `<p style="margin: 8px 0;">• <a href="${l.url}" style="color: #0066cc; text-decoration: none;">${courseName}</a></p>`;
      })
      .join('');

    // Send email using Brevo API
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: "David's Pdf System", email: 'davidazranhit@gmail.com' },
        to: [{ email: email }],
        subject: 'קבצים מהקורס',
        htmlContent: `
          <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
            <p style="margin-bottom: 16px;">שלום,</p>
            <p style="margin-bottom: 16px;">מצורפים הקבצים שלך לקורס.</p>
            <p style="margin-bottom: 16px;">הקבצים מותאמים אישית עבורך – עם הפרטים שלך – והם נועדו לשימוש אישי בלבד.</p>
            <p style="margin-bottom: 16px;">חשוב לדעת: כל שיתוף או העתקה של הקבצים נחשבים להפרה חמורה של זכויות יוצרים, ויגררו השלכות בהתאם.</p>
            <p style="margin-bottom: 12px; margin-top: 20px;"><strong>קבצים להורדה (זמינים ל-3 ימים):</strong></p>
            <div style="margin-right: 20px;">
              ${listItems}
            </div>
            <p style="margin-top: 20px;">בהצלחה בקורס!</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Brevo API error:', errorData);
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const emailResult = await emailResponse.json();
    console.log('Email with links sent successfully via Brevo:', emailResult);

    return new Response(JSON.stringify({ success: true, emailResult }), {
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