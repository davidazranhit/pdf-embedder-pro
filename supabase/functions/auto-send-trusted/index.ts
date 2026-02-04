import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckAndSendRequest {
  email: string;
  id_number: string;
  course_name: string;
  request_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CheckAndSendRequest = await req.json();
    const email = (payload.email ?? "").trim().toLowerCase();
    const id_number = (payload.id_number ?? "").replace(/\D/g, "").padStart(9, "0").slice(-9);
    const course_name = (payload.course_name ?? "").trim();
    const request_id = payload.request_id;

    console.log("Checking trusted combination for:", { email, id_number, course_name, request_id });

    if (!email || !id_number || !course_name) {
      return new Response(
        JSON.stringify({ trusted: false, sent: false, error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Check if this combination is trusted
    const { data: trustedData, error: trustedError } = await supabase
      .from("trusted_combinations")
      .select("id")
      .eq("email", email)
      .eq("id_number", id_number)
      .eq("course_name", course_name)
      .maybeSingle();

    if (trustedError) {
      console.error("Error checking trusted combinations:", trustedError);
      return new Response(
        JSON.stringify({ trusted: false, error: trustedError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (!trustedData) {
      console.log("Combination not trusted, manual processing required");
      return new Response(
        JSON.stringify({ trusted: false, sent: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    // If request_id is not provided (public form insert can't RETURNING due to RLS),
    // locate the latest matching request so we can update its status.
    let effectiveRequestId = request_id;
    if (!effectiveRequestId) {
      const { data: latestReq, error: latestReqError } = await supabase
        .from("file_requests")
        .select("id")
        .eq("email", email)
        .eq("id_number", id_number)
        .eq("course_name", course_name)
        .order("submission_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestReqError) {
        console.error("Error locating latest request:", latestReqError);
      }

      effectiveRequestId = latestReq?.id;
      console.log("Effective request id:", effectiveRequestId);
    }


    console.log("Trusted combination found! Auto-sending files...");

    // Get all templates in the course category
    const { data: templates, error: templatesError } = await supabase
      .from("pdf_templates")
      .select("file_path, name")
      .eq("category", course_name);

    if (templatesError || !templates || templates.length === 0) {
      console.error("No templates found for course:", course_name);
      return new Response(
        JSON.stringify({ trusted: true, sent: false, error: "No templates found for course" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Found ${templates.length} templates for course ${course_name}`);

    // Process watermarks
    const fileIds = templates.map(t => t.file_path);
    
    const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-watermark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        fileIds,
        email,
        userId: id_number,
      }),
    });

    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      console.error("Error processing watermarks:", errorText);
      return new Response(
        JSON.stringify({ trusted: true, sent: false, error: "Failed to process watermarks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const processData = await processResponse.json();
    
    if (!processData?.files || processData.files.length === 0) {
      console.error("No files processed");
      return new Response(
        JSON.stringify({ trusted: true, sent: false, error: "No files processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Prepare files for sending
    const processedFiles = processData.files.map((f: any) => ({
      processedId: f.processedId,
      originalName: f.originalName,
    }));

    // Send email with files
    const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-watermarked-files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        email,
        fileIds: processedFiles,
        courseName: course_name,
      }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("Error sending files:", errorText);
      return new Response(
        JSON.stringify({ trusted: true, sent: false, error: "Failed to send email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Update request status to sent
    if (effectiveRequestId) {
      const { error: updateError } = await supabase
        .from("file_requests")
        .update({
          status: "sent",
          sent_date: new Date().toISOString(),
        })
        .eq("id", effectiveRequestId);

      if (updateError) {
        console.error("Error updating request status:", updateError);
      }
    } else {
      console.warn("No request id to update status for (sent email anyway)");
    }

    console.log("Auto-send completed successfully!");

    return new Response(
      JSON.stringify({ 
        trusted: true, 
        sent: true, 
        fileCount: processedFiles.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in auto-send-trusted:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
