import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!brevoApiKey) {
      console.log("BREVO_API_KEY not configured, skipping notification");
      return new Response(
        JSON.stringify({ success: false, reason: "BREVO_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get settings
    const { data: settings, error: settingsError } = await supabase
      .from("watermark_settings")
      .select("admin_email, pending_alert_threshold")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw new Error("Failed to fetch settings");
    }

    const adminEmail = settings?.admin_email;
    const threshold = settings?.pending_alert_threshold || 5;

    if (!adminEmail) {
      console.log("No admin email configured, skipping notification");
      return new Response(
        JSON.stringify({ success: false, reason: "No admin email configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count pending requests
    const { count, error: countError } = await supabase
      .from("file_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (countError) {
      console.error("Error counting pending requests:", countError);
      throw new Error("Failed to count pending requests");
    }

    const pendingCount = count || 0;
    console.log(`Pending requests: ${pendingCount}, threshold: ${threshold}`);

    if (pendingCount >= threshold) {
      // Send notification email via Brevo
      const systemUrl = "https://pdf-embedder.lovable.app/sys-admin";
      
      const emailHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">🔔 התראה על בקשות ממתינות</h1>
          
          <div style="background: #f7f7fa; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="font-size: 18px; margin: 0;">
              יש לך <strong style="color: #8B5CF6; font-size: 24px;">${pendingCount}</strong> בקשות ממתינות במערכת
            </p>
          </div>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${systemUrl}" style="background: linear-gradient(135deg, #8B5CF6, #D946EF); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              כניסה למערכת
            </a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #888; font-size: 12px; text-align: center;">
            הודעה אוטומטית זו נשלחה כי מספר הבקשות הממתינות עבר את הסף שהוגדר (${threshold})
          </p>
        </div>
      `;

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "David's Pdf System", email: "davidazranhit@gmail.com" },
          to: [{ email: adminEmail }],
          subject: `📋 ממתינות לך ${pendingCount} בקשות במערכת`,
          htmlContent: emailHtml,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Brevo API error:", errorData);
        throw new Error(`Brevo API error: ${response.status}`);
      }

      const result = await response.json();
      console.log("Notification email sent:", result);

      return new Response(
        JSON.stringify({ 
          success: true, 
          sent: true,
          pendingCount,
          adminEmail,
          messageId: result.messageId 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: false, 
        reason: `Pending count (${pendingCount}) is below threshold (${threshold})` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in notify-pending-requests:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
