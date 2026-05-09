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
      await new Promise((r) => setTimeout(r, 1500));
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
      timer = setTimeout(
        () =>
          resolve({
            data: null,
            error: new Error("הבקשה חרגה מזמן התגובה המותר"),
          }),
        timeoutMs
      );
    });

    try {
      const invokePromise = supabase.functions
        .invoke(functionName, { body })
        .then(({ data, error }) => ({
          data: (data ?? null) as T | null,
          error: error
            ? new Error(typeof error === "string" ? error : (error as any).message || "Edge function error")
            : null,
        }))
        .catch((err: any) => ({
          data: null as T | null,
          error: err instanceof Error ? err : new Error(String(err)),
        }));

      const result = await Promise.race([invokePromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      if (result.error) {
        lastError = result.error;
        continue;
      }
      return { data: result.data as T, error: null };
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  return { data: null, error: lastError ?? new Error("Unknown error") };
}
