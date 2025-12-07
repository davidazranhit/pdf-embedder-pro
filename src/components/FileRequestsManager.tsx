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
import { FileText, Send, Filter, FileStack, Calendar as CalendarIcon, X } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

interface Category {
  name: string;
  count: number;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequests();
    fetchTemplates();
  }, []);

  useEffect(() => {
    let base = statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter);
    
    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((r) =>
        r.email.toLowerCase().includes(q) || r.id_number.toLowerCase().includes(q) || r.course_name.toLowerCase().includes(q)
      );
    }
    
    // Date range filter
    if (startDate) {
      base = base.filter((r) => new Date(r.submission_date) >= startDate);
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      base = base.filter((r) => new Date(r.submission_date) <= endOfDay);
    }
    
    setFilteredRequests(base);
  }, [statusFilter, requests, search, startDate, endDate]);

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
      
      // Extract unique categories with counts
      const categoryMap = new Map<string, number>();
      (data || []).forEach((template) => {
        categoryMap.set(template.category, (categoryMap.get(template.category) || 0) + 1);
      });
      
      const uniqueCategories = Array.from(categoryMap.entries()).map(([name, count]) => ({
        name,
        count,
      }));
      
      setCategories(uniqueCategories);
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

  const handleSendFromCategory = async () => {
    if (!selectedRequest || !selectedCategory) return;

    setIsSending(true);
    try {
      // Get all templates in the selected category
      const categoryTemplates = templates.filter((t) => t.category === selectedCategory);
      
      if (categoryTemplates.length === 0) {
        toast({ title: "שגיאה", description: "לא נמצאו קבצים בקטגוריה זו", variant: "destructive" });
        return;
      }

      toast({
        title: "מעבד קבצים",
        description: `מעבד ${categoryTemplates.length} קבצים...`,
      });

      // Collect all file paths from the category
      const allFileIds = categoryTemplates.map((template) => template.file_path);

      // Process watermarks for all files at once (same as in Index.tsx)
      const { data: processData, error: processError } = await supabase.functions.invoke(
        "process-watermark",
        {
          body: {
            fileIds: allFileIds,
            email: selectedRequest.email,
            userId: selectedRequest.id_number,
          },
        }
      );

      if (processError || !processData?.files || processData.files.length === 0) {
        console.error("Error processing watermarks:", processError);
        toast({
          title: "שגיאה",
          description: "לא הצלחנו לעבד את הקבצים",
          variant: "destructive",
        });
        return;
      }

      // Extract processed file info with original names
      const processedFiles = processData.files.map((f: any) => ({
        processedId: f.processedId,
        originalName: f.originalName
      }));

      // Send email with all processed files (including original names)
      const { error: sendError } = await supabase.functions.invoke("send-watermarked-files", {
        body: {
          email: selectedRequest.email,
          fileIds: processedFiles,
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
        description: `${processedFiles.length} קבצים נשלחו בהצלחה`,
      });

      setShowTemplateDialog(false);
      setSelectedRequest(null);
      setSelectedCategory("");
      fetchRequests();
    } catch (error) {
      console.error("Error in handleSendFromCategory:", error);
      toast({
        title: "שגיאה",
        description: "שגיאה כללית בתהליך השליחה",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickFilter = (value: string) => {
    setQuickFilter(value);
    const now = new Date();
    
    switch (value) {
      case "today":
        setStartDate(new Date(now.setHours(0, 0, 0, 0)));
        setEndDate(new Date());
        break;
      case "week":
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        setStartDate(weekAgo);
        setEndDate(new Date());
        break;
      case "month":
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setStartDate(monthAgo);
        setEndDate(new Date());
        break;
      case "all":
      default:
        setStartDate(undefined);
        setEndDate(undefined);
        break;
    }
  };

  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setQuickFilter("all");
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
            <DialogTitle>שלח קבצים מקטגוריה</DialogTitle>
            <DialogDescription>
              בחר קטגוריה לשליחת כל הקבצים ל-{selectedRequest?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">בחר קטגוריה</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר קטגוריה..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name} ({category.count} קבצים)
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
                  setSelectedCategory("");
                }}
                disabled={isSending}
              >
                ביטול
              </Button>
              <Button
                onClick={handleSendFromCategory}
                disabled={!selectedCategory || isSending}
              >
                {isSending ? "מעבד ושולח..." : "שלח קבצים"}
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
                  placeholder="חיפוש לפי ת.ז, מייל או קורס"
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

            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">סינון לפי תאריך:</span>
              
              <select
                value={quickFilter}
                onChange={(e) => handleQuickFilter(e.target.value)}
                className="px-3 py-1.5 border rounded-lg bg-background text-sm"
              >
                <option value="all">כל התאריכים</option>
                <option value="today">היום</option>
                <option value="week">שבוע אחרון</option>
                <option value="month">חודש אחרון</option>
              </select>

              <span className="text-sm text-muted-foreground">או בחר טווח:</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-right font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "מתאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      setQuickFilter("all");
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-right font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "עד תאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date);
                      setQuickFilter("all");
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearDateFilters}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4" />
                  נקה
                </Button>
              )}
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
                        <div className="flex flex-col gap-1.5">
                          <Button size="sm" className="w-full" onClick={() => handleGoToSingleUser(request)}>
                            <Send className="w-4 h-4 ml-2" />
                            שלח קבצים
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowTemplateDialog(true);
                            }}
                          >
                            <FileStack className="w-4 h-4 ml-2" />
                            שלח מקטגוריה
                          </Button>
                          <Button size="sm" variant="outline" className="w-full" onClick={() => toggleStatus(request)}>
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
