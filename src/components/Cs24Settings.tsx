import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plug, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const Cs24Settings = () => {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [tutorId, setTutorId] = useState("1");
  const [baseUrl, setBaseUrl] = useState("https://api.cs24.co.il/tutor/students/export");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("external_api_settings" as any)
      .select("api_key, config")
      .eq("provider", "cs24")
      .maybeSingle();

    if (error) {
      console.error("load CS24 settings", error);
    } else if (data) {
      const row = data as any;
      setApiKey(row.api_key ?? "");
      const cfg = row.config ?? {};
      setTutorId(cfg.tutor_id ?? "1");
      setBaseUrl(cfg.base_url ?? "https://api.cs24.co.il/tutor/students/export");
    }
    setIsLoading(false);
  };

  const save = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("external_api_settings" as any)
      .upsert(
        {
          provider: "cs24",
          api_key: apiKey.trim() || null,
          config: { tutor_id: tutorId.trim() || "1", base_url: baseUrl.trim() },
        } as any,
        { onConflict: "provider" },
      );
    setIsSaving(false);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "נשמר", description: "הגדרות CS24 עודכנו" });
    }
  };

  return (
    <Card className="p-8 shadow-lg border-border/50 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2 text-foreground">
          <Plug className="w-6 h-6 inline-block ml-2" />
          חיבור ל-CS24 (שליחה אוטומטית)
        </h2>
        <p className="text-sm text-muted-foreground">
          כאשר משתמש ממלא טופס בקשה, המערכת בודקת ב-CS24 אם יש לו גישה פעילה (ACTIVE) לקורס המבוקש —
          ואם כן, הקבצים נשלחים אוטומטית. משתמשים מסומנים כחשודים לעולם לא יקבלו שליחה אוטומטית.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cs24-api-key">API Key</Label>
            <Input
              id="cs24-api-key"
              type="password"
              placeholder="••••••••"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              dir="ltr"
              className="text-left font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              נשמר באופן מאובטח בבסיס הנתונים, גישה רק לאדמינים.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cs24-tutor-id">Tutor ID</Label>
            <Input
              id="cs24-tutor-id"
              value={tutorId}
              onChange={(e) => setTutorId(e.target.value)}
              dir="ltr"
              className="text-left"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cs24-base-url">Base URL</Label>
            <Input
              id="cs24-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              dir="ltr"
              className="text-left font-mono text-sm"
            />
          </div>

          <Button onClick={save} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמור
          </Button>
        </div>
      )}
    </Card>
  );
};