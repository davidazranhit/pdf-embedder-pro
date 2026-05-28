import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Cs24Log {
  id: string;
  created_at: string;
  email: string | null;
  id_number: string | null;
  course_name: string | null;
  request_id: string | null;
  duration_ms: number | null;
  api_status: number | null;
  outcome: string;
  reason: string | null;
  matched_student: any;
  error_message: string | null;
}

const outcomeVariant = (
  outcome: string,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (outcome) {
    case "sent":
      return "default";
    case "no_match":
      return "secondary";
    case "skipped":
      return "outline";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
};

const outcomeLabel = (outcome: string) => {
  switch (outcome) {
    case "sent":
      return "נשלח";
    case "no_match":
      return "לא נמצא";
    case "skipped":
      return "דולג";
    case "error":
      return "שגיאה";
    default:
      return outcome;
  }
};

const reasonLabel = (reason: string | null) => {
  if (!reason) return "—";
  const map: Record<string, string> = {
    ok: "נשלח בהצלחה",
    missing_fields: "שדות חסרים",
    suspicious: "משתמש חשוד",
    too_many_requests: "3+ בקשות לאותו קורס",
    no_api_key: "מפתח API לא מוגדר",
    cs24_api_error: "שגיאת CS24 API",
    student_not_found: "סטודנט לא נמצא במייל",
    no_active_course_access: "נמצא, אך אין גישה פעילה לקורס",
    no_templates: "אין קבצים לקורס",
    watermark_failed: "כישלון בעיבוד הוטרמרק",
    no_processed_files: "לא עובדו קבצים",
    email_failed: "כישלון בשליחת המייל",
    exception: "חריגה במערכת",
  };
  return map[reason] ?? reason;
};

const Cs24Logs = () => {
  const [logs, setLogs] = useState<Cs24Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Cs24Log | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cs24_auto_send_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({
        title: "שגיאה בטעינת לוגים",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLogs((data as Cs24Log[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? logs.filter(
        (l) =>
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.course_name ?? "").toLowerCase().includes(q) ||
          (l.id_number ?? "").includes(q) ||
          (l.outcome ?? "").toLowerCase().includes(q) ||
          (l.reason ?? "").toLowerCase().includes(q),
      )
    : logs;

  const counts = logs.reduce(
    (acc, l) => {
      acc.total++;
      acc[l.outcome] = (acc[l.outcome] ?? 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-2">
            <Link to="/sys-admin">
              <Button variant="outline" className="gap-2">
                <ArrowRight className="w-4 h-4" />
                חזרה
              </Button>
            </Link>
            <Button onClick={load} variant="outline" className="gap-2" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              רענן
            </Button>
          </div>

          <div>
            <h1 className="text-3xl font-bold">לוגים של שליחה אוטומטית (CS24)</h1>
            <p className="text-muted-foreground mt-1">
              כל קריאה לבדיקת גישה ושליחה אוטומטית, כולל זמן תגובה, סטטוס וסטודנט מותאם.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">סה״כ</div>
              <div className="text-2xl font-bold">{counts.total}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">נשלחו</div>
              <div className="text-2xl font-bold text-primary">{counts.sent ?? 0}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">לא נמצאו</div>
              <div className="text-2xl font-bold">{counts.no_match ?? 0}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">דולגו</div>
              <div className="text-2xl font-bold">{counts.skipped ?? 0}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">שגיאות</div>
              <div className="text-2xl font-bold text-destructive">{counts.error ?? 0}</div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי מייל, תז, קורס, סיבה..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                dir="rtl"
                className="text-right"
              />
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">זמן</TableHead>
                    <TableHead className="text-right">תוצאה</TableHead>
                    <TableHead className="text-right">סיבה</TableHead>
                    <TableHead className="text-right">מייל</TableHead>
                    <TableHead className="text-right">קורס</TableHead>
                    <TableHead className="text-right">תז</TableHead>
                    <TableHead className="text-right">משך (ms)</TableHead>
                    <TableHead className="text-right">סטטוס API</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        טוען...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        אין לוגים להצגה
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((l) => (
                      <TableRow
                        key={l.id}
                        className="cursor-pointer"
                        onClick={() => setSelected(l)}
                      >
                        <TableCell className="whitespace-nowrap text-right" dir="ltr">
                          {new Date(l.created_at).toLocaleString("he-IL")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={outcomeVariant(l.outcome)}>
                            {outcomeLabel(l.outcome)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{reasonLabel(l.reason)}</TableCell>
                        <TableCell className="text-right" dir="ltr">{l.email ?? "—"}</TableCell>
                        <TableCell className="text-right">{l.course_name ?? "—"}</TableCell>
                        <TableCell className="text-right" dir="ltr">{l.id_number ?? "—"}</TableCell>
                        <TableCell className="text-right">{l.duration_ms ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {l.api_status != null ? (
                            <Badge
                              variant={
                                l.api_status >= 200 && l.api_status < 300
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {l.api_status}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי לוג</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground">זמן</div>
                  <div dir="ltr">{new Date(selected.created_at).toLocaleString("he-IL")}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">משך</div>
                  <div>{selected.duration_ms ?? "—"} ms</div>
                </div>
                <div>
                  <div className="text-muted-foreground">תוצאה</div>
                  <Badge variant={outcomeVariant(selected.outcome)}>
                    {outcomeLabel(selected.outcome)}
                  </Badge>
                </div>
                <div>
                  <div className="text-muted-foreground">סיבה</div>
                  <div>{reasonLabel(selected.reason)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">מייל</div>
                  <div dir="ltr">{selected.email ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">תעודת זהות</div>
                  <div dir="ltr">{selected.id_number ?? "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">קורס</div>
                  <div>{selected.course_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">סטטוס API</div>
                  <div>{selected.api_status ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">request_id</div>
                  <div className="truncate" dir="ltr">{selected.request_id ?? "—"}</div>
                </div>
              </div>

              {selected.error_message && (
                <div>
                  <div className="text-muted-foreground mb-1">שגיאה</div>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap" dir="ltr">
                    {selected.error_message}
                  </pre>
                </div>
              )}

              {selected.matched_student && (
                <div>
                  <div className="text-muted-foreground mb-1">סטודנט שנמצא ב-CS24</div>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap overflow-x-auto" dir="ltr">
                    {JSON.stringify(selected.matched_student, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cs24Logs;