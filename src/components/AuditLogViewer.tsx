import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { History, RefreshCw, Search, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { format } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Json | null;
  new_data: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  "request.created": "בקשה נוצרה",
  "request.sent": "קבצים נשלחו",
  "request.status_changed": "סטטוס שונה",
  "template.uploaded": "תבנית הועלתה",
  "template.deleted": "תבנית נמחקה",
  "settings.updated": "הגדרות עודכנו",
  "user.login": "התחברות",
  "user.logout": "התנתקות",
  "api_key.created": "מפתח API נוצר",
  "api_key.deleted": "מפתח API נמחק",
  "webhook.created": "Webhook נוצר",
  "webhook.deleted": "Webhook נמחק",
  "trusted.added": "משתמש מהימן נוסף",
  "suspicious.marked": "משתמש סומן כחשוד",
};

export function AuditLogViewer() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    loadLogs();
  }, [actionFilter, page]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setLogs(data || []);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      console.error("Error loading audit logs:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את יומן הפעולות",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.table_name?.toLowerCase().includes(query) ||
      log.record_id?.toLowerCase().includes(query)
    );
  });

  const getActionBadge = (action: string) => {
    if (action.includes("delete") || action.includes("removed")) {
      return <Badge variant="destructive">{ACTION_LABELS[action] || action}</Badge>;
    }
    if (action.includes("create") || action.includes("added")) {
      return <Badge className="bg-emerald-500 dark:bg-emerald-600">{ACTION_LABELS[action] || action}</Badge>;
    }
    if (action.includes("update") || action.includes("changed")) {
      return <Badge variant="secondary">{ACTION_LABELS[action] || action}</Badge>;
    }
    return <Badge variant="outline">{ACTION_LABELS[action] || action}</Badge>;
  };

  const formatJsonPreview = (data: Json | null) => {
    if (!data || typeof data !== 'object') return null;
    return (
      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  if (isLoading && logs.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-semibold">יומן פעולות</h3>
        </div>
        
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
        
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 ml-2" />
            <SelectValue placeholder="סוג פעולה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הפעולות</SelectItem>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>אין רשומות ביומן</p>
          <p className="text-sm">פעולות יתועדו כאן אוטומטית</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="border rounded-lg overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-center gap-3 flex-1">
                  {getActionBadge(log.action)}
                  {log.table_name && (
                    <span className="text-sm text-muted-foreground">
                      {log.table_name}
                    </span>
                  )}
                  {log.record_id && (
                    <span className="text-xs font-mono text-muted-foreground truncate max-w-[100px]">
                      {log.record_id}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                  </span>
                  {expandedLog === log.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {expandedLog === log.id && (
                <div className="border-t p-3 bg-muted/20 space-y-3">
                  {log.ip_address && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">כתובת IP: </span>
                      <span className="font-mono">{log.ip_address}</span>
                    </div>
                  )}
                  
                  {log.old_data && (
                    <div>
                      <span className="text-sm text-muted-foreground block mb-1">נתונים קודמים:</span>
                      {formatJsonPreview(log.old_data)}
                    </div>
                  )}
                  
                  {log.new_data && (
                    <div>
                      <span className="text-sm text-muted-foreground block mb-1">נתונים חדשים:</span>
                      {formatJsonPreview(log.new_data)}
                    </div>
                  )}
                  
                  {log.user_agent && (
                    <div className="text-xs text-muted-foreground truncate">
                      {log.user_agent}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            הקודם
          </Button>
          <span className="py-2 px-3 text-sm text-muted-foreground">
            עמוד {page + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
          >
            הבא
          </Button>
        </div>
      )}
    </Card>
  );
}
