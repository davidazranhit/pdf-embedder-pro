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

    // Load email template settings from database
    const { data: settings } = await supabase
      .from('watermark_settings')
      .select('email_subject, email_body')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    const emailSubject = settings?.email_subject ?? 'הקבצים המבוקשים שלך';
    const emailBodyText = settings?.email_body ?? `שלום,

מצורפים הקבצים שלך לקורס.

הקבצים מותאמים אישית עבורך – עם הפרטים שלך – והם נועדו לשימוש אישי בלבד.

חשוב לדעת: כל שיתוף או העתקה של הקבצים נחשבים להפרה חמורה של זכויות יוצרים, ויגררו השלכות בהתאם.`;

    // Build signed download links instead of attaching files to avoid memory limits
    const links: { name: string; url: string }[] = [];

    // fileIds can be either strings or objects with {processedId, originalName}
    for (const fileItem of fileIds) {
      try {
        // Support both old format (string) and new format (object with originalName)
        const fileId = typeof fileItem === 'string' ? fileItem : (fileItem as any).processedId || fileItem;
        const providedName = typeof fileItem === 'object' ? (fileItem as any).originalName : undefined;
        
        let finalFileName: string;
        
        if (providedName) {
          // Use the provided original name (Hebrew name from system)
          finalFileName = providedName.endsWith('.pdf') ? providedName : `${providedName}.pdf`;
          console.log("Using provided original name:", finalFileName);
        } else {
          // Fallback: try to find from template table by matching file path
          const processedFileName = (typeof fileId === 'string' ? fileId : '').split('/').pop() || 'document.pdf';
          
          // Extract the base template file ID from the processed path
          // Format is usually: processed/file-xxx_userId.pdf -> templates/file-xxx.pdf
          const baseMatch = processedFileName.match(/^(.+?)_[^_]+\.pdf$/);
          const templateFileName = baseMatch ? `${baseMatch[1]}.pdf` : processedFileName;
          
          const { data: templateData } = await supabase
            .from('pdf_templates')
            .select('name, file_path')
            .ilike('file_path', `%${templateFileName}%`)
            .maybeSingle();

          if (templateData?.name) {
            finalFileName = templateData.name.endsWith('.pdf') ? templateData.name : `${templateData.name}.pdf`;
            console.log("Found template name from DB:", finalFileName);
          } else {
            // Use original processed filename as fallback
            finalFileName = processedFileName;
            console.log("Using processed filename as fallback:", finalFileName);
          }
        }

        // Create download URL using our one-time download function
        const actualFileId = typeof fileId === 'string' ? fileId : '';
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const downloadUrl = `${supabaseUrl}/functions/v1/download-file?path=${encodeURIComponent(actualFileId)}&name=${encodeURIComponent(finalFileName)}`;

        links.push({ name: finalFileName, url: downloadUrl });
      } catch (err) {
        console.error('Error preparing link for', fileItem, err);
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
        return `<p style="margin: 8px 0;">• <a href="${l.url}" style="color: #0066cc; text-decoration: none;">${l.name}</a></p>`;
      })
      .join('');

    // Convert email body text to HTML paragraphs
    const emailBodyHtml = emailBodyText
      .split('\n')
      .map((line: string) => line.trim() === '' ? '<br/>' : `<p style="margin-bottom: 16px;">${line}</p>`)
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
        subject: emailSubject,
        htmlContent: `
          <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
            ${emailBodyHtml}
            <p style="margin-bottom: 12px; margin-top: 20px;"><strong>קבצים להורדה (הורדה חד-פעמית בלבד!):</strong></p>
            <p style="color: #d32f2f; font-size: 14px; margin-bottom: 12px;">שים לב: כל קובץ ניתן להורדה פעם אחת בלבד. לאחר ההורדה הקובץ לא יהיה זמין יותר.</p>
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