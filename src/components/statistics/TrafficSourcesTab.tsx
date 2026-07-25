import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, Link2, ExternalLink, Eye } from "lucide-react";

interface Row {
  id: string;
  email: string;
  course_name: string;
  submission_date: string;
  referrer: string | null;
  landing_url: string | null;
  traffic_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

export const TrafficSourcesTab = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("file_requests")
        .select("id,email,course_name,submission_date,referrer,landing_url,traffic_source,utm_source,utm_medium,utm_campaign,utm_content,utm_term")
        .order("submission_date", { ascending: false })
        .limit(1000);
      if (error) console.error(error);
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
  }, []);

  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const key = r.traffic_source || "direct";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const byCampaign = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      if (!r.utm_campaign) return;
      map.set(r.utm_campaign, (map.get(r.utm_campaign) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const generatedUrl = useMemo(() => {
    const base = `${window.location.origin}/request-access`;
    const params = new URLSearchParams();
    if (source.trim()) params.set("utm_source", source.trim());
    if (medium.trim()) params.set("utm_medium", medium.trim());
    if (campaign.trim()) params.set("utm_campaign", campaign.trim());
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [source, medium, campaign]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "הועתק", description: text });
    } catch {
      const t = document.createElement("textarea");
      t.value = text; document.body.appendChild(t); t.select();
      document.execCommand("copy"); document.body.removeChild(t);
      toast({ title: "הועתק" });
    }
  };

  const shortHost = (url: string | null) => {
    if (!url) return "—";
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url; }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      {/* Link builder */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">בניית קישור עם מעקב</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          שתפו את הקישור בערוץ ספציפי (וואטסאפ, אינסטגרם, קמפיין מייל וכו') כדי לדעת בדיוק מאיפה הגיעה כל בקשה.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>מקור (utm_source)</Label>
            <Input dir="ltr" placeholder="whatsapp" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>אמצעי (utm_medium)</Label>
            <Input dir="ltr" placeholder="social" value={medium} onChange={(e) => setMedium(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>קמפיין (utm_campaign)</Label>
            <Input dir="ltr" placeholder="semester-b-2026" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Input dir="ltr" readOnly value={generatedUrl} className="flex-1 text-xs sm:text-sm bg-muted/50" />
          <div className="flex gap-2">
            <Button onClick={() => copy(generatedUrl)} className="gap-2">
              <Copy className="w-4 h-4" /> העתק
            </Button>
            <Button variant="outline" onClick={() => window.open(generatedUrl, "_blank")} className="gap-2">
              <ExternalLink className="w-4 h-4" /> פתח
            </Button>
          </div>
        </div>
      </Card>

      {/* Aggregated by source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">בקשות לפי מקור</h3>
          {bySource.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין נתונים עדיין</p>
          ) : (
            <div className="space-y-2">
              {bySource.map(([src, count]) => (
                <div key={src} className="flex justify-between items-center py-2 border-b last:border-0">
                  <Badge variant="outline" className="font-mono text-xs">{src}</Badge>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">בקשות לפי קמפיין</h3>
          {byCampaign.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין קמפיינים מסומנים עדיין</p>
          ) : (
            <div className="space-y-2">
              {byCampaign.map(([c, count]) => (
                <div key={c} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-sm">{c}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Full table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">מקור לכל בקשה</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">טוען...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">אין בקשות</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">מייל</TableHead>
                  <TableHead className="text-right">מקור</TableHead>
                  <TableHead className="text-right">קמפיין</TableHead>
                  <TableHead className="text-right">הפניה מ־</TableHead>
                  <TableHead className="text-right">פרטים</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmt(r.submission_date)}</TableCell>
                    <TableCell className="text-sm">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {r.traffic_source || "direct"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.utm_campaign || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{shortHost(r.referrer)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>פרטי מקור הבקשה</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              {[
                ["מייל", detail.email],
                ["קורס", detail.course_name],
                ["מקור (traffic_source)", detail.traffic_source],
                ["utm_source", detail.utm_source],
                ["utm_medium", detail.utm_medium],
                ["utm_campaign", detail.utm_campaign],
                ["utm_content", detail.utm_content],
                ["utm_term", detail.utm_term],
                ["Referrer", detail.referrer],
                ["Landing URL", detail.landing_url],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span dir="ltr" className="text-right break-all font-mono text-xs">{v || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};