import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Hash function for API key validation
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get API key from header
    const apiKey = req.headers.get("X-API-Key");
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing X-API-Key header" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }

    // Validate API key
    const keyPrefix = apiKey.substring(0, 7);
    const keyHash = await hashKey(apiKey);

    const { data: apiKeyData, error: keyError } = await supabase
      .from("api_keys")
      .select("id, permissions, expires_at, is_active")
      .eq("key_prefix", keyPrefix)
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !apiKeyData) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }

    if (!apiKeyData.is_active) {
      return new Response(
        JSON.stringify({ error: "API key is disabled" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403 
        }
      );
    }

    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "API key has expired" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403 
        }
      );
    }

    // Update last used timestamp
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyData.id);

    // Parse the URL to determine the endpoint
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Expected format: /api-gateway/{resource}/{action?}/{id?}
    const resource = pathParts[1] || "";
    const action = pathParts[2] || "";
    const resourceId = pathParts[3] || "";

    const permissions = apiKeyData.permissions as string[];

    // Route to appropriate handler
    switch (resource) {
      case "requests": {
        if (req.method === "GET") {
          if (!permissions.includes("read_requests")) {
            return new Response(
              JSON.stringify({ error: "Permission denied: read_requests required" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
            );
          }

          const status = url.searchParams.get("status");
          const limit = parseInt(url.searchParams.get("limit") || "50");
          const offset = parseInt(url.searchParams.get("offset") || "0");

          let query = supabase
            .from("file_requests")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

          if (status) {
            query = query.eq("status", status);
          }

          const { data, count, error } = await query;

          if (error) throw error;

          return new Response(
            JSON.stringify({ data, total: count, limit, offset }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (req.method === "PATCH" && resourceId) {
          if (!permissions.includes("write_requests")) {
            return new Response(
              JSON.stringify({ error: "Permission denied: write_requests required" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
            );
          }

          const body = await req.json();
          const { data, error } = await supabase
            .from("file_requests")
            .update(body)
            .eq("id", resourceId)
            .select()
            .single();

          if (error) throw error;

          return new Response(
            JSON.stringify({ data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        break;
      }

      case "templates": {
        if (req.method === "GET") {
          if (!permissions.includes("read_templates")) {
            return new Response(
              JSON.stringify({ error: "Permission denied: read_templates required" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
            );
          }

          const category = url.searchParams.get("category");
          
          let query = supabase
            .from("pdf_templates")
            .select("id, name, category, file_size, created_at")
            .order("name");

          if (category) {
            query = query.eq("category", category);
          }

          const { data, error } = await query;

          if (error) throw error;

          return new Response(
            JSON.stringify({ data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        break;
      }

      case "courses": {
        if (req.method === "GET") {
          if (!permissions.includes("read_templates")) {
            return new Response(
              JSON.stringify({ error: "Permission denied: read_templates required" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
            );
          }

          const { data, error } = await supabase
            .from("courses")
            .select("*")
            .eq("is_active", true)
            .order("name");

          if (error) throw error;

          return new Response(
            JSON.stringify({ data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        break;
      }

      case "categories": {
        if (req.method === "GET") {
          if (!permissions.includes("read_templates")) {
            return new Response(
              JSON.stringify({ error: "Permission denied: read_templates required" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
            );
          }

          const { data, error } = await supabase
            .from("categories")
            .select("*")
            .order("name");

          if (error) throw error;

          return new Response(
            JSON.stringify({ data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        break;
      }

      case "statistics": {
        if (req.method === "GET") {
          if (!permissions.includes("read_requests")) {
            return new Response(
              JSON.stringify({ error: "Permission denied: read_requests required" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
            );
          }

          const { data: requests, error } = await supabase
            .from("file_requests")
            .select("status, created_at, sent_date");

          if (error) throw error;

          const stats = {
            total: requests?.length || 0,
            pending: requests?.filter(r => r.status === "pending").length || 0,
            sent: requests?.filter(r => r.status === "sent").length || 0,
            handled_not_sent: requests?.filter(r => r.status === "handled_not_sent").length || 0,
          };

          return new Response(
            JSON.stringify({ data: stats }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        break;
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: "Unknown endpoint",
            available_endpoints: [
              "GET /requests",
              "PATCH /requests/{id}",
              "GET /templates",
              "GET /courses",
              "GET /categories",
              "GET /statistics",
            ]
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  } catch (error) {
    console.error("Error in api-gateway:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
