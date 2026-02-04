import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as hexEncode } from "https://deno.land/std@0.190.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TriggerRequest {
  webhookId?: string;
  event: string;
  payload: Record<string, unknown>;
}

// HMAC-SHA256 signature generation
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return new TextDecoder().decode(hexEncode(new Uint8Array(signature)));
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

    const { webhookId, event, payload }: TriggerRequest = await req.json();
    console.log("Triggering webhook for event:", event, "webhookId:", webhookId);

    // Get webhooks to trigger
    let query = supabase
      .from("webhooks")
      .select("*")
      .eq("is_active", true);

    if (webhookId) {
      // Specific webhook (for testing)
      query = query.eq("id", webhookId);
    } else {
      // Filter by event
      query = query.contains("events", [event]);
    }

    const { data: webhooks, error: webhookError } = await query;

    if (webhookError) {
      throw new Error(`Failed to fetch webhooks: ${webhookError.message}`);
    }

    if (!webhooks || webhooks.length === 0) {
      console.log("No active webhooks found for event:", event);
      return new Response(
        JSON.stringify({ success: true, triggered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const webhook of webhooks) {
      const webhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      };

      const payloadString = JSON.stringify(webhookPayload);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "PDF-System-Webhook/1.0",
      };

      // Add signature if secret is configured
      if (webhook.secret) {
        const signature = await generateSignature(payloadString, webhook.secret);
        headers["X-Webhook-Signature"] = `sha256=${signature}`;
      }

      let success = false;
      let responseStatus: number | null = null;
      let responseBody: string | null = null;

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: payloadString,
        });

        responseStatus = response.status;
        responseBody = await response.text();
        success = response.ok;

        console.log(`Webhook ${webhook.name} response:`, responseStatus, responseBody.substring(0, 200));
      } catch (fetchError) {
        console.error(`Webhook ${webhook.name} failed:`, fetchError);
        responseBody = fetchError instanceof Error ? fetchError.message : "Unknown error";
      }

      // Log the webhook call
      await supabase.from("webhook_logs").insert({
        webhook_id: webhook.id,
        event,
        payload: webhookPayload,
        response_status: responseStatus,
        response_body: responseBody?.substring(0, 1000),
        success,
      });

      // Update webhook stats
      if (success) {
        await supabase
          .from("webhooks")
          .update({
            last_triggered_at: new Date().toISOString(),
            failure_count: 0,
          })
          .eq("id", webhook.id);
      } else {
        await supabase
          .from("webhooks")
          .update({
            last_triggered_at: new Date().toISOString(),
            failure_count: webhook.failure_count + 1,
          })
          .eq("id", webhook.id);
      }

      results.push({
        webhookId: webhook.id,
        name: webhook.name,
        success,
        status: responseStatus,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        triggered: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in trigger-webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
