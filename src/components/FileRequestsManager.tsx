import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
// TemplateManager removed in simplified flow

interface FileRequest {
  id: string;
  email: string;
  id_number: string;
  course_name: string;
  submission_date: string;
  status: "pending" | "sent";
  sent_date: string | null;
}


export const FileRequestsManager = () => {
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<FileRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent">("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequests();
  }, []);

useEffect(() => {
    let base = statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((r) =>
        r.email.toLowerCase().includes(q) || r.id_number.toLowerCase().includes(q)
      );
    }
    setFilteredRequests(base);
  }, [statusFilter, requests, search]);

  const fetchRequests = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("file_requests")
      .select("*")
      .order("submission_date", { ascending: false });

    if (error) {
      console.error("Error fetching requests:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את הבקשות",
        variant: "destructive",
      });
    } else {
      setRequests(data || []);
    }
    setIsLoading(false);
  };

  const handleGoToSingleUser = (request: FileRequest) => {
    // Navigate to main screen with prefilled params
    const url = `/sys-admin?tab=single&email=${encodeURIComponent(request.email)}&id=${encodeURIComponent(request.id_number)}`;
    navigate(url);
  };

  const toggleStatus = async (request: FileRequest) => {
    const newStatus = request.status === "sent" ? "pending" : "sent";
    const { error } = await supabase
      .from("file_requests")
      .update({
        status: newStatus,
        sent_date: newStatus === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", request.id);

    if (error) {
      console.error("Error updating status:", error);
      toast({ title: "שגיאה", description: "לא ניתן לעדכן סטטוס", variant: "destructive" });
      return;
    }

    setRequests((prev) => prev.map((r) => r.id === request.id ? { ...r, status: newStatus, sent_date: newStatus === "sent" ? new Date().toISOString() : null } : r));
    toast({ title: "עודכן", description: newStatus === "sent" ? "סומן כטופל" : "סומן כלא טופל" });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("he-IL", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-foreground">בקשות לקבצים</h3>
              <div className="flex items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש לפי ת.ז או מייל"
                  className="max-w-[220px]"
                />
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 border rounded-lg bg-background text-sm"
                >
                  <option value="all">הכל</option>
                  <option value="pending">לא טופל</option>
                  <option value="sent">טופל</option>
                </select>
              </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">טוען...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>אין בקשות במערכת</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מייל</TableHead>
                    <TableHead className="text-right">תעודת זהות</TableHead>
                    <TableHead className="text-right">קורס מבוקש</TableHead>
                    <TableHead className="text-right">תאריך בקשה</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.email}</TableCell>
                      <TableCell>{request.id_number}</TableCell>
                      <TableCell>{request.course_name}</TableCell>
                      <TableCell>{formatDate(request.submission_date)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={request.status === "sent" ? "default" : "secondary"}
                        >
                          {request.status === "sent" ? "טופל" : "לא טופל"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => handleGoToSingleUser(request)}>
                            <Send className="w-4 h-4 ml-2" />
                            שלח קבצים
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => toggleStatus(request)}>
                            {request.status === "sent" ? "סמן לא טופל" : "סמן טופל"}
                          </Button>
                        </div>
                        {request.status === "sent" && request.sent_date && (
                          <div className="text-xs text-muted-foreground mt-1">
                            נשלח ב-{formatDate(request.sent_date)}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

    </>
  );
};
