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

    console.log("Starting cleanup of old files...");

    // List all files in the processed folder
    const { data: files, error: listError } = await supabase.storage
      .from("pdf-files")
      .list("processed");

    if (listError) {
      console.error("Error listing files:", listError);
      throw listError;
    }

    console.log(`Found ${files?.length || 0} files in processed folder`);

    // Calculate cutoff date (3 days ago)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    console.log(`Cutoff date: ${threeDaysAgo.toISOString()}`);

    const filesToDelete: string[] = [];

    // Check each file's age
    for (const file of files || []) {
      const fileCreatedAt = new Date(file.created_at);
      
      if (fileCreatedAt < threeDaysAgo) {
        filesToDelete.push(`processed/${file.name}`);
        console.log(`Marking for deletion: ${file.name} (created: ${fileCreatedAt.toISOString()})`);
      }
    }

    console.log(`Files to delete: ${filesToDelete.length}`);

    // Delete old files
    if (filesToDelete.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from("pdf-files")
        .remove(filesToDelete);

      if (deleteError) {
        console.error("Error deleting files:", deleteError);
        throw deleteError;
      }

      console.log(`Successfully deleted ${filesToDelete.length} files`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: filesToDelete.length,
        deletedFiles: filesToDelete,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in cleanup-old-files:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
