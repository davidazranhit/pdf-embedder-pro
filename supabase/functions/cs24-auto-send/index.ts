import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  email: string;
  id_number: string;
  course_name: string;
  request_id?: string;
}

/** Strip everything from the first hyphen onward, then trim. */
function stripCourseTutor(name: string): string {
  if (!name) return "";
  const idx = name.indexOf("-");
  const base = idx >= 0 ? name.slice(0, idx) : name;
  return base.replace(/\s+/g, " ").trim();
}

function courseMatches(formCourse: string, apiCourse: string): boolean {
  const a = stripCourseTutor(formCourse).toLowerCase();
  const b = stripCourseTutor(apiCourse).toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = (await req.json()) as Payload;
    const email = (payload.email ?? "").trim().toLowerCase();
    const id_number = (payload.id_number ?? "").replace(/\D/g, "").padStart(9, "0").slice(-9);
    const course_name = (payload.course_name ?? "").trim();
    let request_id = payload.request_id;

    if (!email || !id_number || !course_name) {
      return new Response(
        JSON.stringify({ sent: false, reason: "missing_fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 1) Suspicious check — never auto-send if user is flagged.
    const { data: suspicious } = await supabase
      .from("suspicious_combinations")
      .select("id")
      .eq("email", email)
      .eq("id_number", id_number)
      .maybeSingle();

    if (suspicious) {
      console.log("Suspicious combination, skipping auto-send");
      return new Response(
        JSON.stringify({ sent: false, reason: "suspicious" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 1b) Rate-limit: if the user already has 3+ requests for the same course,
    // do NOT auto-send — let an admin handle it manually.
    const { count: existingCount } = await supabase
      .from("file_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("id_number", id_number)
      .eq("course_name", course_name);

    if ((existingCount ?? 0) >= 3) {
      console.log("User has 3+ requests for this course, skipping auto-send");
      return new Response(
        JSON.stringify({ sent: false, reason: "too_many_requests" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 2) Load CS24 settings
    const { data: settings } = await supabase
      .from("external_api_settings")
      .select("api_key, config")
      .eq("provider", "cs24")
      .maybeSingle();

    const apiKey = settings?.api_key;
    const tutorId = (settings?.config as any)?.tutor_id ?? "1";
    const baseUrl = (settings?.config as any)?.base_url ?? "https://api.cs24.co.il/tutor/students/export";

    if (!apiKey) {
      console.log("CS24 api key not configured, skipping");
      return new Response(
        JSON.stringify({ sent: false, reason: "no_api_key" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 3) Call CS24 API
    const cs24Url = `${baseUrl}?tutor_id=${encodeURIComponent(tutorId)}&api_key=${encodeURIComponent(apiKey)}`;
    const cs24Res = await fetch(cs24Url);
    if (!cs24Res.ok) {
      console.error("CS24 API error", cs24Res.status, await cs24Res.text());
      return new Response(
        JSON.stringify({ sent: false, reason: "cs24_api_error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }
    const cs24Data = await cs24Res.json();
    const rows: Array<{ name?: string; email?: string; course?: string; status?: string }> =
      Array.isArray(cs24Data?.rows) ? cs24Data.rows : Array.isArray(cs24Data) ? cs24Data : [];

    const match = rows.find(
      (r) =>
        (r.email ?? "").trim().toLowerCase() === email &&
        (r.status ?? "").trim().toLowerCase() === "active" &&
        courseMatches(course_name, r.course ?? ""),
    );

    if (!match) {
      console.log("No active CS24 access for", email, "course", course_name);
      return new Response(
        JSON.stringify({ sent: false, reason: "no_access" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 4) Locate request_id if not given
    if (!request_id) {
      const { data: latest } = await supabase
        .from("file_requests")
        .select("id")
        .eq("email", email)
        .eq("id_number", id_number)
        .eq("course_name", course_name)
        .order("submission_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      request_id = latest?.id;
    }

    // 5) Find templates for the requested course
    const { data: templates } = await supabase
      .from("pdf_templates")
      .select("file_path, name")
      .eq("category", course_name);

    if (!templates || templates.length === 0) {
      console.log("No templates found for course", course_name);
      return new Response(
        JSON.stringify({ sent: false, reason: "no_templates" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 6) Process watermarks
    const fileIds = templates.map((t) => t.file_path);
    const processRes = await fetch(`${supabaseUrl}/functions/v1/process-watermark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ fileIds, email, userId: id_number }),
    });

    if (!processRes.ok) {
      console.error("process-watermark failed", await processRes.text());
      return new Response(
        JSON.stringify({ sent: false, reason: "watermark_failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const processData = await processRes.json();
    const processedFiles = (processData?.files ?? []).map((f: any) => ({
      processedId: f.processedId,
      originalName: f.originalName,
    }));

    if (processedFiles.length === 0) {
      return new Response(
        JSON.stringify({ sent: false, reason: "no_processed_files" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 7) Send email
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-watermarked-files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        fileIds: processedFiles,
        courseName: course_name,
        idNumber: id_number,
      }),
    });

    if (!sendRes.ok) {
      console.error("send-watermarked-files failed", await sendRes.text());
      return new Response(
        JSON.stringify({ sent: false, reason: "email_failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 8) Mark request as auto-sent
    if (request_id) {
      const { error: updateErr } = await supabase
        .from("file_requests")
        .update({
          status: "sent",
          sent_date: new Date().toISOString(),
          auto_sent: true,
        })
        .eq("id", request_id);
      if (updateErr) console.error("Failed to update request status:", updateErr);
    }

    return new Response(
      JSON.stringify({ sent: true, fileCount: processedFiles.length, auto: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("cs24-auto-send error", err);
    return new Response(
      JSON.stringify({ sent: false, reason: "exception", error: String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});