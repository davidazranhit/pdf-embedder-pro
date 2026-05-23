import { supabase } from "@/integrations/supabase/client";

interface InvokeOptions {
  functionName: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  retries?: number;
  onAttempt?: (attempt: number, retries: number) => void;
  /** External AbortSignal — when aborted, the in-flight fetch is cancelled and no more retries run. */
  signal?: AbortSignal;
  /** Skip session lookup and invoke immediately with the publishable key. Useful for public functions. */
  skipSession?: boolean;
}

async function resolveAuthHeader(anonKey: string, skipSession?: boolean): Promise<string> {
  const fallback = `Bearer ${anonKey}`;

  if (skipSession) {
    return fallback;
  }

  try {
    return await Promise.race([
      supabase.auth
        .getSession()
        .then(({ data }) => {
          const token = data?.session?.access_token;
          return token ? `Bearer ${token}` : fallback;
        })
        .catch(() => fallback),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve(fallback), 350);
      }),
    ]);
  } catch {
    return fallback;
  }
}

/**
 * Invoke a Supabase edge function via raw fetch with a *real* AbortController
 * timeout and retry logic.
 *
 * Why not `supabase.functions.invoke`?
 * That helper does not expose its underlying AbortSignal, so when a mobile
 * network drops (e.g. Wi-Fi → 4G handover) the fetch stays pending on a dead
 * socket forever and the UI hangs at "process watermark". Using fetch directly
 * lets us abort the dead request and actually retry on a fresh connection.
 */
export async function invokeWithRetry<T = any>({
  functionName,
  body,
  timeoutMs = 45_000, // 45s per attempt — fail fast
  retries = 1,
  onAttempt,
  signal,
  skipSession,
}: InvokeOptions): Promise<{ data: T; error: null } | { data: null; error: Error }> {
  let lastError: Error | null = null;

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string;
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  // For public functions, never let auth/session resolution block the actual request.
  const authHeader = await resolveAuthHeader(anonKey, skipSession);

  // Sanity check — if env is missing the request would silently never go out.
  if (!supabaseUrl || !anonKey) {
    return {
      data: null,
      error: new Error("תצורת השרת חסרה. רענן את הדף ונסה שוב."),
    };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      return { data: null, error: new Error("בוטל על ידי המשתמש") };
    }
    if (attempt > 0) {
      console.log(`Retry ${attempt}/${retries} for ${functionName}`);
      await new Promise((r) => setTimeout(r, 800));
    }
    onAttempt?.(attempt, retries);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);

      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }

      if (!res.ok) {
        const msg =
          (parsed && typeof parsed === "object" && (parsed.error || parsed.message)) ||
          `Edge function ${functionName} returned ${res.status}`;
        lastError = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        // 4xx (except 408/429) are not transient — don't retry
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          return { data: null, error: lastError };
        }
        continue;
      }

      return { data: parsed as T, error: null };
    } catch (err: any) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
      if (signal?.aborted) {
        return { data: null, error: new Error("בוטל על ידי המשתמש") };
      }
      const aborted = err?.name === "AbortError";
      lastError = aborted
        ? new Error("הבקשה חרגה מזמן התגובה — מנסה שוב...")
        : err instanceof Error
        ? err
        : new Error(String(err));
      continue;
    }
  }

  return { data: null, error: lastError ?? new Error("Unknown error") };
}
