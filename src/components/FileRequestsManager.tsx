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
import { FileText, Send, Filter, FileStack } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FileRequest {
  id: string;
  email: string;
  id_number: string;
  course_name: string;
  submission_date: string;
  status: "pending" | "sent";
  sent_date: string | null;
}

interface Template {
  id: string;
  name: string;
  category: string;
  file_path: string;
}


export const FileRequestsManager = () => {
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<FileRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent">("all");
  const [search, setSearch] = useState("");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FileRequest | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequests();
    fetchTemplates();
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

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("pdf_templates")
      .select("*")
      .order("category", { ascending: true });

    if (error) {
      console.error("Error fetching templates:", error);
    } else {
      setTemplates(data || []);
    }
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

  const handleSendFromTemplate = async () => {
    if (!selectedRequest || !selectedTemplateId) return;

    setIsSending(true);
    try {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (!template) {
        toast({ title: "שגיאה", description: "תבנית לא נמצאה", variant: "destructive" });
        return;
      }

      // Process watermark for the selected template file
      const { data: processData, error: processError } = await supabase.functions.invoke(
        "process-watermark",
        {
          body: {
            filePath: template.file_path,
            email: selectedRequest.email,
            userId: selectedRequest.id_number,
            fileName: template.name,
          },
        }
      );

      if (processError || !processData?.processedFilePath) {
        console.error("Error processing watermark:", processError);
        toast({
          title: "שגיאה",
          description: "שגיאה בעיבוד הקובץ",
          variant: "destructive",
        });
        return;
      }

      // Send email with the processed file
      const { error: sendError } = await supabase.functions.invoke("send-watermarked-files", {
        body: {
          email: selectedRequest.email,
          fileIds: [processData.processedFilePath],
        },
      });

      if (sendError) {
        console.error("Error sending email:", sendError);
        toast({
          title: "שגיאה",
          description: "שגיאה בשליחת המייל",
          variant: "destructive",
        });
        return;
      }

      // Update request status
      await supabase
        .from("file_requests")
        .update({
          status: "sent",
          sent_date: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      toast({
        title: "הצלחה",
        description: "הקבצים נשלחו בהצלחה",
      });

      setShowTemplateDialog(false);
      setSelectedRequest(null);
      setSelectedTemplateId("");
      fetchRequests();
    } catch (error) {
      console.error("Error in handleSendFromTemplate:", error);
      toast({
        title: "שגיאה",
        description: "שגיאה כללית בתהליך השליחה",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
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
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>שלח קבצים מתבנית</DialogTitle>
            <DialogDescription>
              בחר תבנית לשליחה ל-{selectedRequest?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">בחר תבנית</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר תבנית..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRequest && (
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <div>
                  <strong>מייל:</strong> {selectedRequest.email}
                </div>
                <div>
                  <strong>תעודת זהות:</strong> {selectedRequest.id_number}
                </div>
                <div>
                  <strong>קורס:</strong> {selectedRequest.course_name}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTemplateDialog(false);
                  setSelectedRequest(null);
                  setSelectedTemplateId("");
                }}
                disabled={isSending}
              >
                ביטול
              </Button>
              <Button
                onClick={handleSendFromTemplate}
                disabled={!selectedTemplateId || isSending}
              >
                {isSending ? "שולח..." : "שלח קבצים"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowTemplateDialog(true);
                            }}
                          >
                            <FileStack className="w-4 h-4 ml-2" />
                            שלח מתבנית
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
