import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  requestId: string;
  fileIds: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = (await req.json()) as Payload;
    const requestId = payload.requestId?.trim();
    const fileIds = Array.isArray(payload.fileIds) ? payload.fileIds.filter(Boolean) : [];

    if (!requestId || fileIds.length === 0) {
      return respond({ error: "Missing requestId or fileIds" }, 400);
    }

    const { data: requestRow, error: requestError } = await supabase
      .from("file_requests")
      .select("id, email, id_number, course_name, status, sent_date")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !requestRow) {
      return respond({ error: "Request not found" }, 404);
    }

    if (requestRow.status === "sent" && requestRow.sent_date) {
      return respond({
        success: true,
        fileCount: fileIds.length,
        sentAt: requestRow.sent_date,
        alreadySent: true,
      });
    }

    const processRes = await fetch(`${supabaseUrl}/functions/v1/process-watermark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        fileIds,
        email: requestRow.email,
        userId: requestRow.id_number,
      }),
    });

    if (!processRes.ok) {
      const errorText = await processRes.text();
      console.error("process-watermark failed", errorText);
      return respond({ error: "Failed to process watermarks" }, 500);
    }

    const processData = await processRes.json();
    const processedFiles = Array.isArray(processData?.files)
      ? processData.files.map((file: any) => ({
          processedId: file.processedId,
          originalName: file.originalName,
        }))
      : [];

    if (processedFiles.length === 0) {
      return respond({ error: "No processed files returned" }, 500);
    }

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-watermarked-files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email: requestRow.email,
        fileIds: processedFiles,
        courseName: requestRow.course_name,
        idNumber: requestRow.id_number,
      }),
    });

    if (!sendRes.ok) {
      const errorText = await sendRes.text();
      console.error("send-watermarked-files failed", errorText);
      return respond({ error: "Failed to send email" }, 500);
    }

    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("file_requests")
      .update({
        status: "sent",
        sent_date: sentAt,
        auto_sent: false,
      })
      .eq("id", requestId)
      .neq("status", "sent");

    if (updateError) {
      console.error("Failed to update file request after send", updateError);
      return respond({ error: "Email sent but status update failed" }, 500);
    }

    return respond({
      success: true,
      fileCount: processedFiles.length,
      sentAt,
      alreadySent: false,
    });
  } catch (error) {
    console.error("Error in send-request-files:", error);
    return respond(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});