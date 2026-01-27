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

    // Get file path and filename from query params
    const url = new URL(req.url);
    const filePath = url.searchParams.get("path");
    const fileName = url.searchParams.get("name") || "document.pdf";

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: "Missing file path" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Download request for:", filePath, "Name:", fileName);

    // Check if file exists
    const { data: fileList, error: listError } = await supabase.storage
      .from("pdf-files")
      .list(filePath.split('/').slice(0, -1).join('/'), {
        search: filePath.split('/').pop()
      });

    if (listError) {
      console.error("Error checking file:", listError);
      return new Response(
        JSON.stringify({ error: "Error checking file availability" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const fileExists = fileList && fileList.length > 0;
    if (!fileExists) {
      console.log("File not found or expired:", filePath);
      // Redirect to the error page in the app
      const appUrl = "https://pdf-embedder.lovable.app";
      return new Response(null, {
        headers: { 
          ...corsHeaders,
          "Location": `${appUrl}/file-unavailable`,
        },
        status: 302
      });
    }

    // Download the file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pdf-files")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Error downloading file:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Convert blob to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();

    // Files are kept for 3 days and cleaned up by the cleanup-old-files function
    // Multiple downloads are allowed within this period

    // Return the file with proper headers for download (attachment forces download, not preview)
    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": arrayBuffer.byteLength.toString(),
      },
      status: 200,
    });

  } catch (error) {
    console.error("Error in download-file:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
