import { useState, useEffect, useMemo } from "react";
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
import { FileText, Send, Filter, FileStack, Calendar as CalendarIcon, X, Users, ArrowLeft, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Checkbox } from "@/components/ui/checkbox";

interface FileRequest {
  id: string;
  email: string;
  id_number: string;
  course_name: string;
  notes: string | null;
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

interface Course {
  id: string;
  name: string;
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
  const [userFilter, setUserFilter] = useState<{ type: 'email' | 'id_number'; value: string } | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [courses, setCourses] = useState<Course[]>([]);
  
  // New state for file selection dialog
  const [showFileSendDialog, setShowFileSendDialog] = useState(false);
  const [selectedFilesDialogCategory, setSelectedFilesDialogCategory] = useState<string>("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [sendingRequest, setSendingRequest] = useState<FileRequest | null>(null);
  const [isSendingFiles, setIsSendingFiles] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Calculate request counts per user (by email and id_number)
  const userRequestCounts = useMemo(() => {
    const emailCounts = new Map<string, number>();
    const idCounts = new Map<string, number>();
    
    requests.forEach((r) => {
      emailCounts.set(r.email, (emailCounts.get(r.email) || 0) + 1);
      idCounts.set(r.id_number, (idCounts.get(r.id_number) || 0) + 1);
    });
    
    return { emailCounts, idCounts };
  }, [requests]);

  const isRepeatUser = (request: FileRequest) => {
    const emailCount = userRequestCounts.emailCounts.get(request.email) || 0;
    const idCount = userRequestCounts.idCounts.get(request.id_number) || 0;
    return emailCount > 1 || idCount > 1;
  };

  const getRepeatCount = (request: FileRequest) => {
    const emailCount = userRequestCounts.emailCounts.get(request.email) || 0;
    const idCount = userRequestCounts.idCounts.get(request.id_number) || 0;
    return Math.max(emailCount, idCount);
  };

  const handleFilterByUser = (request: FileRequest, type: 'email' | 'id_number') => {
    setUserFilter({ type, value: type === 'email' ? request.email : request.id_number });
  };

  const clearUserFilter = () => {
    setUserFilter(null);
  };

  useEffect(() => {
    fetchRequests();
    fetchTemplates();
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching courses:", error);
    } else {
      setCourses(data || []);
    }
  };

  useEffect(() => {
    let base = statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter);
    
    // User filter (by email or id_number)
    if (userFilter) {
      base = base.filter((r) => 
        userFilter.type === 'email' 
          ? r.email === userFilter.value 
          : r.id_number === userFilter.value
      );
    }
    
    // Course filter
    if (courseFilter !== "all") {
      base = base.filter((r) => r.course_name === courseFilter);
    }
    
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
  }, [statusFilter, requests, search, startDate, endDate, userFilter, courseFilter]);

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

  // Get templates filtered by selected category
  const filteredTemplatesForDialog = selectedFilesDialogCategory 
    ? templates.filter((t) => t.category === selectedFilesDialogCategory)
    : [];

  const handleToggleFileSelection = (fileId: string) => {
    setSelectedFileIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleSelectAllFiles = () => {
    if (selectedFileIds.size === filteredTemplatesForDialog.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredTemplatesForDialog.map((t) => t.id)));
    }
  };

  const handleOpenFileSendDialog = (request: FileRequest) => {
    setSendingRequest(request);
    // Auto-select category based on course name if matching category exists
    const matchingCategory = categories.find(c => c.name === request.course_name);
    setSelectedFilesDialogCategory(matchingCategory ? matchingCategory.name : "");
    setSelectedFileIds(new Set());
    setShowFileSendDialog(true);
  };

  const handleSendSelectedFiles = async () => {
    if (!sendingRequest || selectedFileIds.size === 0) return;

    setIsSendingFiles(true);
    try {
      // Get selected templates
      const selectedTemplatesList = filteredTemplatesForDialog.filter((t) => 
        selectedFileIds.has(t.id)
      );
      
      if (selectedTemplatesList.length === 0) {
        toast({ title: "שגיאה", description: "לא נבחרו קבצים לשליחה", variant: "destructive" });
        return;
      }

      toast({
        title: "מעבד קבצים",
        description: `מעבד ${selectedTemplatesList.length} קבצים...`,
      });

      // Collect all file paths
      const allFileIds = selectedTemplatesList.map((template) => template.file_path);

      // Process watermarks
      const { data: processData, error: processError } = await supabase.functions.invoke(
        "process-watermark",
        {
          body: {
            fileIds: allFileIds,
            email: sendingRequest.email,
            userId: sendingRequest.id_number,
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

      // Extract processed file info
      const processedFiles = processData.files.map((f: any) => ({
        processedId: f.processedId,
        originalName: f.originalName
      }));

      // Send email
      const { error: sendError } = await supabase.functions.invoke("send-watermarked-files", {
        body: {
          email: sendingRequest.email,
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
        .eq("id", sendingRequest.id);

      toast({
        title: "הצלחה",
        description: `${processedFiles.length} קבצים נשלחו בהצלחה`,
      });

      setShowFileSendDialog(false);
      setSendingRequest(null);
      setSelectedFilesDialogCategory("");
      setSelectedFileIds(new Set());
      fetchRequests();
    } catch (error) {
      console.error("Error in handleSendSelectedFiles:", error);
      toast({
        title: "שגיאה",
        description: "שגיאה כללית בתהליך השליחה",
        variant: "destructive",
      });
    } finally {
      setIsSendingFiles(false);
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
              <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
                <div>
                  <strong>מייל:</strong> {selectedRequest.email}
                </div>
                <div>
                  <strong>תעודת זהות:</strong> {selectedRequest.id_number}
                </div>
                <div>
                  <strong>קורס:</strong> {selectedRequest.course_name}
                </div>
                {selectedRequest.notes && (
                  <div className="pt-2 border-t border-border">
                    <strong>הערות:</strong>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{selectedRequest.notes}</p>
                  </div>
                )}
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

      {/* New File Selection Dialog */}
      <Dialog open={showFileSendDialog} onOpenChange={setShowFileSendDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>שלח קבצים נבחרים</DialogTitle>
            <DialogDescription>
              בחר קטגוריה ולאחר מכן סמן את הקבצים שברצונך לשלוח ל-{sendingRequest?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Request Info */}
            {sendingRequest && (
              <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
                <div>
                  <strong>מייל:</strong> {sendingRequest.email}
                </div>
                <div>
                  <strong>תעודת זהות:</strong> {sendingRequest.id_number}
                </div>
                <div>
                  <strong>קורס מבוקש:</strong> {sendingRequest.course_name}
                </div>
                {sendingRequest.notes && (
                  <div className="pt-2 border-t border-border">
                    <strong>הערות:</strong>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{sendingRequest.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Category Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">בחר קטגוריה</label>
              <Select 
                value={selectedFilesDialogCategory} 
                onValueChange={(value) => {
                  setSelectedFilesDialogCategory(value);
                  setSelectedFileIds(new Set());
                }}
              >
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

            {/* File List */}
            {selectedFilesDialogCategory && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    קבצים בקטגוריה ({filteredTemplatesForDialog.length})
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllFiles}
                  >
                    {selectedFileIds.size === filteredTemplatesForDialog.length ? "בטל הכל" : "בחר הכל"}
                  </Button>
                </div>
                <div className="border rounded-lg max-h-[250px] overflow-y-auto">
                  {filteredTemplatesForDialog.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      אין קבצים בקטגוריה זו
                    </div>
                  ) : (
                    filteredTemplatesForDialog.map((template) => (
                      <div
                        key={template.id}
                        className={cn(
                          "flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors",
                          selectedFileIds.has(template.id) && "bg-primary/10"
                        )}
                        onClick={() => handleToggleFileSelection(template.id)}
                      >
                        <Checkbox
                          checked={selectedFileIds.has(template.id)}
                          onCheckedChange={() => handleToggleFileSelection(template.id)}
                        />
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1 text-sm">{template.name}</span>
                        {selectedFileIds.has(template.id) && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    ))
                  )}
                </div>
                {selectedFileIds.size > 0 && (
                  <div className="text-sm text-muted-foreground">
                    נבחרו {selectedFileIds.size} קבצים
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFileSendDialog(false);
                  setSendingRequest(null);
                  setSelectedFilesDialogCategory("");
                  setSelectedFileIds(new Set());
                }}
                disabled={isSendingFiles}
              >
                ביטול
              </Button>
              <Button
                onClick={handleSendSelectedFiles}
                disabled={selectedFileIds.size === 0 || isSendingFiles}
              >
                {isSendingFiles ? "מעבד ושולח..." : `שלח ${selectedFileIds.size} קבצים`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="p-4 md:p-6">
          <div className="space-y-4">
            {/* Header - Mobile optimized */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg md:text-xl font-semibold text-foreground">בקשות לקבצים</h3>
                <Badge variant="outline" className="text-xs md:text-sm">
                  {filteredRequests.length === requests.length 
                    ? `${requests.length} בקשות` 
                    : `${filteredRequests.length} מתוך ${requests.length}`}
                </Badge>
              </div>
              
              {userFilter && (
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full w-fit">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    מציג בקשות של: {userFilter.value}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearUserFilter}
                    className="h-5 w-5 p-0 hover:bg-primary/20"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              {/* Filters - Responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש..."
                  className="w-full"
                />
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-background text-sm w-full"
                >
                  <option value="all">כל הקורסים</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.name}>{course.name}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border rounded-lg bg-background text-sm w-full"
                >
                  <option value="all">כל הסטטוסים</option>
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
            <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right font-semibold">מייל</TableHead>
                    <TableHead className="text-right font-semibold">ת.ז</TableHead>
                    <TableHead className="text-right font-semibold">קורס</TableHead>
                    <TableHead className="text-right font-semibold">תאריך</TableHead>
                    <TableHead className="text-right font-semibold">סטטוס</TableHead>
                    <TableHead className="text-right font-semibold">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id} className={cn(
                      "hover:bg-muted/30 transition-colors",
                      isRepeatUser(request) && "bg-amber-50 dark:bg-amber-950/20"
                    )}>
                      <TableCell className="font-medium py-3">
                        <TooltipProvider>
                          <div className="flex items-center gap-2">
                            {isRepeatUser(request) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-800/50 rounded-full flex-shrink-0"
                                    onClick={() => handleFilterByUser(request, 'email')}
                                  >
                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                                      {getRepeatCount(request)}
                                    </span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>משתמש חוזר - לחץ לצפייה בכל הבקשות</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {request.notes && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs px-1.5 py-0.5 cursor-help">
                                    📝
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[300px]">
                                  <p className="whitespace-pre-wrap">{request.notes}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <button
                              onClick={() => handleFilterByUser(request, 'email')}
                              className="hover:underline hover:text-primary transition-colors text-right text-sm truncate max-w-[180px]"
                            >
                              {request.email}
                            </button>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="py-3">
                        <button
                          onClick={() => handleFilterByUser(request, 'id_number')}
                          className="hover:underline hover:text-primary transition-colors text-sm"
                        >
                          {request.id_number}
                        </button>
                      </TableCell>
                      <TableCell className="py-3 text-sm">{request.course_name}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{formatDate(request.submission_date)}</TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant={request.status === "sent" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {request.status === "sent" ? "טופל" : "לא טופל"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" className="h-8 text-xs" onClick={() => handleOpenFileSendDialog(request)}>
                            <Send className="w-3 h-3 ml-1" />
                            שלח
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            onClick={() => {
                              setSelectedRequest(request);
                              // Auto-select category based on course name
                              const matchingCategory = categories.find(c => c.name === request.course_name);
                              setSelectedCategory(matchingCategory ? matchingCategory.name : "");
                              setShowTemplateDialog(true);
                            }}
                          >
                            <FileStack className="w-3 h-3 ml-1" />
                            קטגוריה
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => toggleStatus(request)}>
                            {request.status === "sent" ? "בטל" : "סמן"}
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

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredRequests.map((request) => (
                <div 
                  key={request.id} 
                  className={cn(
                    "border rounded-lg p-4 space-y-3",
                    isRepeatUser(request) && "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                  )}
                >
                  {/* Header with status and repeat indicator */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isRepeatUser(request) && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                          חוזר ({getRepeatCount(request)})
                        </Badge>
                      )}
                      <Badge
                        variant={request.status === "sent" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {request.status === "sent" ? "טופל" : "לא טופל"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(request.submission_date)}</span>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1">
                    <button
                      onClick={() => handleFilterByUser(request, 'email')}
                      className="text-sm font-medium hover:underline hover:text-primary transition-colors block truncate w-full text-right"
                    >
                      {request.email}
                    </button>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>ת.ז: {request.id_number}</span>
                      <span>{request.course_name}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  {request.notes && (
                    <div className="bg-muted/50 rounded p-2 text-sm">
                      <span className="font-medium">הערות: </span>
                      <span className="text-muted-foreground">{request.notes}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" className="flex-1 h-9" onClick={() => handleOpenFileSendDialog(request)}>
                      <Send className="w-4 h-4 ml-1" />
                      שלח קבצים
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 h-9"
                      onClick={() => {
                        setSelectedRequest(request);
                        // Auto-select category based on course name
                        const matchingCategory = categories.find(c => c.name === request.course_name);
                        setSelectedCategory(matchingCategory ? matchingCategory.name : "");
                        setShowTemplateDialog(true);
                      }}
                    >
                      <FileStack className="w-4 h-4 ml-1" />
                      קטגוריה
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => toggleStatus(request)}>
                      {request.status === "sent" ? "בטל" : "✓"}
                    </Button>
                  </div>

                  {request.status === "sent" && request.sent_date && (
                    <div className="text-xs text-muted-foreground text-center">
                      נשלח ב-{formatDate(request.sent_date)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </Card>

    </>
  );
};
