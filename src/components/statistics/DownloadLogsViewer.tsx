import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadLog {
  id: string;
  email: string;
  id_number: string | null;
  file_name: string;
  file_path: string;
  downloaded_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export const DownloadLogsViewer = () => {
  const [logs, setLogs] = useState<DownloadLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("download_logs")
      .select("*")
      .order("downloaded_at", { ascending: false })
      .limit(500);

    if (!error && data) {
      setLogs(data as DownloadLog[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = search.trim()
    ? logs.filter(
        (l) =>
          l.email.toLowerCase().includes(search.toLowerCase()) ||
          l.file_name.toLowerCase().includes(search.toLowerCase()) ||
          (l.id_number && l.id_number.includes(search.trim()))
      )
    : logs;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("he-IL", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Group by email for stats
  const uniqueEmails = new Set(logs.map((l) => l.email)).size;
  const todayCount = logs.filter(
    (l) => new Date(l.downloaded_at).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{logs.length}</p>
              <p className="text-xs text-muted-foreground">סה״כ הורדות</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{todayCount}</p>
              <p className="text-xs text-muted-foreground">הורדות היום</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{uniqueEmails}</p>
              <p className="text-xs text-muted-foreground">מיילים ייחודיים</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Refresh */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">יומן הורדות</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש לפי מייל או שם קובץ..."
                  className="max-w-[250px]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            מציג {filteredLogs.length} מתוך {logs.length} הורדות
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">טוען...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Download className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>אין הורדות מתועדות</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מייל</TableHead>
                    <TableHead className="text-right">תעודת זהות</TableHead>
                    <TableHead className="text-right">שם קובץ</TableHead>
                    <TableHead className="text-right">תאריך הורדה</TableHead>
                    <TableHead className="text-right">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.email}</TableCell>
                      <TableCell className="font-mono text-sm">{log.id_number || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal max-w-[200px] truncate">
                          {log.file_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(log.downloaded_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.ip_address || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
