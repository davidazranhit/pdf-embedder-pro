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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate the user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Check if the user is an admin
    console.log("Checking admin role for user:", user.id, user.email);
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    console.log("Role check result:", { roleData, roleError });

    if (roleError || !roleData) {
      console.error("Admin check failed:", roleError);
      return new Response(
        JSON.stringify({ error: "Only admins can list users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Get all user roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, created_at")
      .order("created_at", { ascending: false });

    if (rolesError) {
      throw rolesError;
    }

    // Get all users from auth.users using admin API
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      throw authError;
    }

    // Create a map of user_id to email
    const userEmailMap = new Map<string, string>();
    authUsers.forEach((u) => {
      userEmailMap.set(u.id, u.email || "");
    });

    // Combine roles with emails
    const usersWithEmails = (roles || []).map((role) => ({
      id: role.id,
      user_id: role.user_id,
      email: userEmailMap.get(role.user_id) || role.user_id,
      role: role.role,
      created_at: role.created_at,
    }));

    return new Response(
      JSON.stringify({ users: usersWithEmails }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in list-users:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
