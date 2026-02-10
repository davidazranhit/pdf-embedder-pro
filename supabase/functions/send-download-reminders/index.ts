import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const apiKey = Deno.env.get("BREVO_API_KEY") ?? "";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing BREVO_API_KEY" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Load settings
    const { data: settings } = await supabase
      .from("watermark_settings")
      .select("download_reminder_enabled, download_reminder_days, download_reminder_subject, download_reminder_body, admin_email")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();

    if (!settings?.download_reminder_enabled) {
      console.log("Download reminders are disabled");
      return new Response(
        JSON.stringify({ message: "Reminders disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const reminderDays = settings.download_reminder_days ?? 2;

    // Find sent requests older than X days that haven't had a reminder sent
    // and haven't been downloaded
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - reminderDays);

    const { data: sentRequests, error: fetchError } = await supabase
      .from("file_requests")
      .select("id, email, course_name, sent_date")
      .eq("status", "sent")
      .is("reminder_sent_at", null)
      .lt("sent_date", cutoffDate.toISOString())
      .not("sent_date", "is", null);

    if (fetchError) {
      console.error("Error fetching sent requests:", fetchError);
      throw fetchError;
    }

    if (!sentRequests || sentRequests.length === 0) {
      console.log("No requests need reminders");
      return new Response(
        JSON.stringify({ message: "No reminders needed", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Found ${sentRequests.length} requests to check for downloads`);

    // Check which emails have download logs after sent_date
    const emailsToRemind: typeof sentRequests = [];

    for (const request of sentRequests) {
      const { count } = await supabase
        .from("download_logs")
        .select("*", { count: "exact", head: true })
        .eq("email", request.email)
        .gte("downloaded_at", request.sent_date!);

      if (count === 0) {
        emailsToRemind.push(request);
      } else {
        // Mark as reminded since they already downloaded
        await supabase
          .from("file_requests")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", request.id);
      }
    }

    if (emailsToRemind.length === 0) {
      console.log("All users have downloaded their files");
      return new Response(
        JSON.stringify({ message: "All downloaded", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Sending reminders to ${emailsToRemind.length} users`);

    const subject = settings.download_reminder_subject ?? "תזכורת: הקבצים שלך ממתינים להורדה";
    const bodyText = settings.download_reminder_body ?? "שלום,\n\nשלחנו לך קבצים אך שמנו לב שטרם הורדת אותם.";

    const bodyHtml = bodyText
      .split("\n")
      .map((line: string) => (line.trim() === "" ? "<br/>" : `<p style="margin-bottom: 16px;">${line}</p>`))
      .join("");

    let sentCount = 0;

    for (const request of emailsToRemind) {
      try {
        const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: "David's Pdf System", email: "davidazranhit@gmail.com" },
            to: [{ email: request.email }],
            subject: request.course_name ? `${subject} - ${request.course_name}` : subject,
            htmlContent: `
              <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
                ${bodyHtml}
              </div>
            `,
          }),
        });

        if (emailResponse.ok) {
          // Mark reminder as sent
          await supabase
            .from("file_requests")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", request.id);
          sentCount++;
          console.log(`Reminder sent to ${request.email}`);
        } else {
          const errData = await emailResponse.json();
          console.error(`Failed to send reminder to ${request.email}:`, errData);
        }
      } catch (err) {
        console.error(`Error sending reminder to ${request.email}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sentCount} reminders`, count: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in send-download-reminders:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
