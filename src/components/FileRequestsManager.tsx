import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Filter } from "lucide-react";
import { TemplateManager } from "./TemplateManager";

interface FileRequest {
  id: string;
  email: string;
  id_number: string;
  submission_date: string;
  status: "pending" | "sent";
  sent_date: string | null;
}

interface Template {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  created_at: string;
  category: string;
}

export const FileRequestsManager = () => {
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<FileRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<FileRequest | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Template[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent">("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (statusFilter === "all") {
      setFilteredRequests(requests);
    } else {
      setFilteredRequests(requests.filter((r) => r.status === statusFilter));
    }
  }, [statusFilter, requests]);

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

  const handleSendFiles = async () => {
    if (!selectedRequest || selectedTemplates.length === 0) {
      toast({
        title: "שגיאה",
        description: "אנא בחר תבניות לשליחה",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      // Process watermarks
      const processedFileIds: string[] = [];
      
      for (const template of selectedTemplates) {
        const { data, error } = await supabase.functions.invoke("process-watermark", {
          body: {
            filePath: template.file_path,
            email: selectedRequest.email,
            userId: selectedRequest.id_number,
            fileName: template.name,
          },
        });

        if (error) throw error;
        if (data?.fileId) {
          processedFileIds.push(data.fileId);
        }
      }

      // Send via email
      const { error: sendError } = await supabase.functions.invoke("send-watermarked-files", {
        body: {
          email: selectedRequest.email,
          fileIds: processedFileIds,
        },
      });

      if (sendError) throw sendError;

      // Update request status
      const { error: updateError } = await supabase
        .from("file_requests")
        .update({ status: "sent", sent_date: new Date().toISOString() })
        .eq("id", selectedRequest.id);

      if (updateError) throw updateError;

      toast({
        title: "הקבצים נשלחו בהצלחה",
        description: `הקבצים נשלחו ל-${selectedRequest.email}`,
      });

      setSelectedRequest(null);
      setSelectedTemplates([]);
      fetchRequests();
    } catch (error) {
      console.error("Error sending files:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לשלוח את הקבצים",
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
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-foreground">בקשות לקבצים</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 border rounded-lg bg-background text-sm"
              >
                <option value="all">הכל</option>
                <option value="pending">ממתין</option>
                <option value="sent">נשלח</option>
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
                      <TableCell>{formatDate(request.submission_date)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={request.status === "sent" ? "default" : "secondary"}
                        >
                          {request.status === "sent" ? "נשלח" : "ממתין"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Send className="w-4 h-4 ml-2" />
                            שלח קבצים
                          </Button>
                        )}
                        {request.status === "sent" && request.sent_date && (
                          <span className="text-xs text-muted-foreground">
                            נשלח ב-{formatDate(request.sent_date)}
                          </span>
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

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>שליחת קבצים</DialogTitle>
            <DialogDescription>
              בחר תבניות לשליחה עבור {selectedRequest?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <TemplateManager
              onTemplateSelect={setSelectedTemplates}
              selectedTemplates={selectedTemplates}
            />

            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedTemplates.length} תבניות נבחרו
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequest(null)}
                  disabled={isSending}
                >
                  ביטול
                </Button>
                <Button
                  onClick={handleSendFiles}
                  disabled={isSending || selectedTemplates.length === 0}
                >
                  <Send className="w-4 h-4 ml-2" />
                  {isSending ? "שולח..." : "שלח קבצים"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
