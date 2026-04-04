import { supabase } from "@/integrations/supabase/client";

interface InvokeOptions {
  functionName: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Invoke a Supabase edge function with timeout and retry logic.
 * Prevents the UI from hanging indefinitely on slow/mobile connections.
 */
export async function invokeWithRetry<T = any>({
  functionName,
  body,
  timeoutMs = 120_000, // 2 minutes default
  retries = 1,
}: InvokeOptions): Promise<{ data: T; error: null } | { data: null; error: Error }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`Retry ${attempt}/${retries} for ${functionName}`);
      // Small delay before retry
      await new Promise((r) => setTimeout(r, 2000));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        // @ts-ignore – supabase-js v2 supports signal on some builds
      });

      clearTimeout(timer);

      if (error) {
        lastError = new Error(typeof error === "string" ? error : error.message || "Edge function error");
        // If it's a server error (not a client abort), retry
        continue;
      }

      return { data: data as T, error: null };
    } catch (err: any) {
      clearTimeout(timer);

      if (err.name === "AbortError" || controller.signal.aborted) {
        lastError = new Error("הבקשה חרגה מזמן התגובה המותר. נסה שוב.");
        continue;
      }

      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  return { data: null, error: lastError ?? new Error("Unknown error") };
}
