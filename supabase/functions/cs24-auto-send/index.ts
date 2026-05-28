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

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  let email = "";
  let id_number = "";
  let course_name = "";
  let request_id: string | undefined;

  const log = async (fields: {
    outcome: string;
    reason?: string;
    api_status?: number | null;
    matched_student?: unknown;
    error_message?: string;
  }) => {
    try {
      await supabase.from("cs24_auto_send_logs").insert({
        email: email || null,
        id_number: id_number || null,
        course_name: course_name || null,
        request_id: request_id ?? null,
        duration_ms: Date.now() - startedAt,
        api_status: fields.api_status ?? null,
        outcome: fields.outcome,
        reason: fields.reason ?? null,
        matched_student: fields.matched_student ?? null,
        error_message: fields.error_message ?? null,
      });
    } catch (e) {
      console.error("cs24 log insert failed:", e);
    }
  };

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  try {
    const payload = (await req.json()) as Payload;
    email = (payload.email ?? "").trim().toLowerCase();
    id_number = (payload.id_number ?? "").replace(/\D/g, "").padStart(9, "0").slice(-9);
    course_name = (payload.course_name ?? "").trim();
    request_id = payload.request_id;

    if (!email || !id_number || !course_name) {
      await log({ outcome: "skipped", reason: "missing_fields" });
      return respond({ sent: false, reason: "missing_fields" });
    }

    // 1) Suspicious check — never auto-send if user is flagged.
    const { data: suspicious } = await supabase
      .from("suspicious_combinations")
      .select("id")
      .eq("email", email)
      .eq("id_number", id_number)
      .maybeSingle();

    if (suspicious) {
      await log({ outcome: "skipped", reason: "suspicious" });
      return respond({ sent: false, reason: "suspicious" });
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
      await log({ outcome: "skipped", reason: "too_many_requests" });
      return respond({ sent: false, reason: "too_many_requests" });
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
      await log({ outcome: "skipped", reason: "no_api_key" });
      return respond({ sent: false, reason: "no_api_key" });
    }

    // 3) Call CS24 API
    const cs24Url = `${baseUrl}?tutor_id=${encodeURIComponent(tutorId)}&api_key=${encodeURIComponent(apiKey)}`;
    const cs24Res = await fetch(cs24Url);
    if (!cs24Res.ok) {
      const errText = await cs24Res.text();
      await log({
        outcome: "error",
        reason: "cs24_api_error",
        api_status: cs24Res.status,
        error_message: errText.slice(0, 500),
      });
      return respond({ sent: false, reason: "cs24_api_error" });
    }
    const cs24Data = await cs24Res.json();
    const rows: Array<{ name?: string; email?: string; course?: string; status?: string }> =
      Array.isArray(cs24Data?.rows) ? cs24Data.rows : Array.isArray(cs24Data) ? cs24Data : [];

    const emailMatches = rows.filter(
      (r) => (r.email ?? "").trim().toLowerCase() === email,
    );
    const match = emailMatches.find(
      (r) =>
        (r.status ?? "").trim().toLowerCase() === "active" &&
        courseMatches(course_name, r.course ?? ""),
    );

    if (!match) {
      const reason = emailMatches.length === 0 ? "student_not_found" : "no_active_course_access";
      await log({
        outcome: "no_match",
        reason,
        api_status: cs24Res.status,
        matched_student: emailMatches.length > 0 ? emailMatches : null,
      });
      return respond({ sent: false, reason });
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
      await log({
        outcome: "error",
        reason: "no_templates",
        matched_student: match,
      });
      return respond({ sent: false, reason: "no_templates" });
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
      const errText = await processRes.text();
      await log({
        outcome: "error",
        reason: "watermark_failed",
        api_status: processRes.status,
        matched_student: match,
        error_message: errText.slice(0, 500),
      });
      return respond({ sent: false, reason: "watermark_failed" });
    }

    const processData = await processRes.json();
    const processedFiles = (processData?.files ?? []).map((f: any) => ({
      processedId: f.processedId,
      originalName: f.originalName,
    }));

    if (processedFiles.length === 0) {
      await log({
        outcome: "error",
        reason: "no_processed_files",
        matched_student: match,
      });
      return respond({ sent: false, reason: "no_processed_files" });
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
      const errText = await sendRes.text();
      await log({
        outcome: "error",
        reason: "email_failed",
        api_status: sendRes.status,
        matched_student: match,
        error_message: errText.slice(0, 500),
      });
      return respond({ sent: false, reason: "email_failed" });
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

    await log({
      outcome: "sent",
      reason: "ok",
      api_status: cs24Res.status,
      matched_student: match,
    });
    return respond({ sent: true, fileCount: processedFiles.length, auto: true });
  } catch (err) {
    console.error("cs24-auto-send error", err);
    await log({
      outcome: "error",
      reason: "exception",
      error_message: String(err).slice(0, 1000),
    });
    return respond({ sent: false, reason: "exception", error: String(err) });
  }
});