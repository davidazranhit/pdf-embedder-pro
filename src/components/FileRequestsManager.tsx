import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FileText, Send, Filter, Calendar as CalendarIcon, X, Users, Check, Mail, User, BookOpen, Clock, MessageSquare, ChevronDown, ShieldCheck, Eye } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

interface TrustedCombination {
  id: string;
  email: string;
  id_number: string;
  course_name: string;
  created_at: string;
}

export const FileRequestsManager = () => {
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<FileRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent">("all");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<{ type: 'email' | 'id_number'; value: string } | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [courses, setCourses] = useState<Course[]>([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [trustedCombinations, setTrustedCombinations] = useState<TrustedCombination[]>([]);
  const [isMarkingTrusted, setIsMarkingTrusted] = useState(false);
  const [isFileListExpanded, setIsFileListExpanded] = useState(false);
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
    fetchTrustedCombinations();
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

  const fetchTrustedCombinations = async () => {
    const { data, error } = await supabase
      .from("trusted_combinations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching trusted combinations:", error);
    } else {
      setTrustedCombinations(data || []);
    }
  };

  const isTrustedCombination = (request: FileRequest) => {
    return trustedCombinations.some(
      (tc) =>
        tc.email === request.email &&
        tc.id_number === request.id_number &&
        tc.course_name === request.course_name
    );
  };

  const handleMarkAsTrusted = async (request: FileRequest) => {
    setIsMarkingTrusted(true);
    try {
      const { error } = await supabase.from("trusted_combinations").insert({
        email: request.email,
        id_number: request.id_number,
        course_name: request.course_name,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "שילוב כבר קיים",
            description: "השילוב הזה כבר מסומן כאמין",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "סומן כאמין ✓",
          description: "בקשות עתידיות עם אותם פרטים יישלחו אוטומטית",
        });
        fetchTrustedCombinations();
      }
    } catch (error) {
      console.error("Error marking as trusted:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לסמן כאמין",
        variant: "destructive",
      });
    } finally {
      setIsMarkingTrusted(false);
    }
  };

  const handleRemoveTrusted = async (request: FileRequest) => {
    try {
      const { error } = await supabase
        .from("trusted_combinations")
        .delete()
        .eq("email", request.email)
        .eq("id_number", request.id_number)
        .eq("course_name", request.course_name);

      if (error) throw error;

      toast({
        title: "הוסר מאמינים",
        description: "השילוב לא יישלח יותר אוטומטית",
      });
      fetchTrustedCombinations();
    } catch (error) {
      console.error("Error removing trusted:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן להסיר מאמינים",
        variant: "destructive",
      });
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
    const categoryName = matchingCategory ? matchingCategory.name : "";
    setSelectedFilesDialogCategory(categoryName);
    
    // Auto-select all files in the matching category
    if (categoryName) {
      const categoryTemplates = templates.filter((t) => t.category === categoryName);
      setSelectedFileIds(new Set(categoryTemplates.map((t) => t.id)));
    } else {
      setSelectedFileIds(new Set());
    }
    setIsFileListExpanded(false); // Start collapsed
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

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("he-IL", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Stats
  const pendingCount = requests.filter(r => r.status === "pending").length;
  const sentCount = requests.filter(r => r.status === "sent").length;

  return (
    <>
      {/* File Selection Dialog */}
      <Dialog open={showFileSendDialog} onOpenChange={setShowFileSendDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">שלח קבצים נבחרים</DialogTitle>
            <DialogDescription>
              בחר קטגוריה וסמן את הקבצים שברצונך לשלוח
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Request Info Card */}
            {sendingRequest && (
              <div className="bg-gradient-to-br from-muted/50 to-muted rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm truncate">{sendingRequest.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{sendingRequest.id_number}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{sendingRequest.course_name}</span>
                </div>
                {sendingRequest.notes && (
                  <div className="pt-3 border-t border-border/50">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-500 mt-0.5" />
                      <p className="text-sm whitespace-pre-wrap">{sendingRequest.notes}</p>
                    </div>
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
                  // Auto-select all files when category changes
                  const categoryTemplates = templates.filter((t) => t.category === value);
                  setSelectedFileIds(new Set(categoryTemplates.map((t) => t.id)));
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="בחר קטגוריה..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{category.name}</span>
                        <Badge variant="secondary" className="text-xs">{category.count} קבצים</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Summary & Selection */}
            {selectedFilesDialogCategory && (
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      {selectedFileIds.size === filteredTemplatesForDialog.length 
                        ? `כל ${filteredTemplatesForDialog.length} הקבצים נבחרו` 
                        : `${selectedFileIds.size} מתוך ${filteredTemplatesForDialog.length} קבצים נבחרו`}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFileListExpanded(!isFileListExpanded)}
                    className="gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    {isFileListExpanded ? "הסתר קבצים" : "בחר קבצים ספציפיים"}
                  </Button>
                </div>

                {/* Expandable file list */}
                {isFileListExpanded && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-muted-foreground">
                        רשימת קבצים
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllFiles}
                        className="h-8 text-xs"
                      >
                        {selectedFileIds.size === filteredTemplatesForDialog.length ? "בטל הכל" : "בחר הכל"}
                      </Button>
                    </div>
                    <div className="border rounded-xl max-h-[200px] overflow-y-auto divide-y bg-background">
                      {filteredTemplatesForDialog.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground">
                          <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>אין קבצים בקטגוריה זו</p>
                        </div>
                      ) : (
                        filteredTemplatesForDialog.map((template) => (
                          <div
                            key={template.id}
                            className={cn(
                              "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-all",
                              selectedFileIds.has(template.id) && "bg-primary/5 hover:bg-primary/10"
                            )}
                            onClick={() => handleToggleFileSelection(template.id)}
                          >
                            <Checkbox
                              checked={selectedFileIds.has(template.id)}
                              onCheckedChange={() => handleToggleFileSelection(template.id)}
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <FileText className={cn(
                              "w-4 h-4",
                              selectedFileIds.has(template.id) ? "text-primary" : "text-muted-foreground"
                            )} />
                            <span className="flex-1 text-sm truncate">{template.name}</span>
                            {selectedFileIds.has(template.id) && (
                              <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t">
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
                className="min-w-[140px]"
              >
                {isSendingFiles ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    מעבד...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    שלח {selectedFileIds.size > 0 ? `${selectedFileIds.size} קבצים` : ""}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Header with Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">בקשות לקבצים</h2>
            <p className="text-sm text-muted-foreground mt-1">ניהול ושליחת בקשות קבצים</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{pendingCount} ממתינות</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">{sentCount} טופלו</span>
            </div>
          </div>
        </div>

        {/* User Filter Banner */}
        {userFilter && (
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-xl">
            <Users className="w-5 h-5" />
            <span className="font-medium">מציג בקשות של:</span>
            <span className="truncate max-w-[250px]">{userFilter.value}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearUserFilter}
              className="mr-auto h-8 hover:bg-primary/20"
            >
              <X className="h-4 w-4 ml-1" />
              נקה סינון
            </Button>
          </div>
        )}

        {/* Search and Filters Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש לפי מייל, ת.ז או קורס..."
                  className="pr-4 h-11"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[130px] h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    <SelectItem value="pending">ממתין</SelectItem>
                    <SelectItem value="sent">טופל</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger className="w-[160px] h-11">
                    <SelectValue placeholder="כל הקורסים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הקורסים</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.name}>{course.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Filters - Collapsible on mobile */}
            <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full sm:hidden flex items-center justify-between h-10 px-3 bg-muted/50 rounded-lg">
                  <span className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    סינון לפי תאריך
                  </span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", isFiltersOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              
              <div className="hidden sm:block">
                <DateFilters
                  quickFilter={quickFilter}
                  handleQuickFilter={handleQuickFilter}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  setQuickFilter={setQuickFilter}
                  clearDateFilters={clearDateFilters}
                />
              </div>
              
              <CollapsibleContent className="sm:hidden pt-3">
                <DateFilters
                  quickFilter={quickFilter}
                  handleQuickFilter={handleQuickFilter}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  setQuickFilter={setQuickFilter}
                  clearDateFilters={clearDateFilters}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Results Count */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {filteredRequests.length === requests.length 
                  ? `סה"כ ${requests.length} בקשות` 
                  : `מציג ${filteredRequests.length} מתוך ${requests.length} בקשות`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {isLoading ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
              <p>טוען בקשות...</p>
            </div>
          </Card>
        ) : filteredRequests.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">אין בקשות להצגה</p>
              <p className="text-sm mt-1">נסה לשנות את הסינון או לחפש משהו אחר</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <Card className="hidden lg:block overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-right font-semibold min-w-[280px]">פרטי קשר</TableHead>
                    <TableHead className="text-right font-semibold min-w-[120px]">קורס</TableHead>
                    <TableHead className="text-right font-semibold w-[130px]">תאריך</TableHead>
                    <TableHead className="text-right font-semibold w-[90px]">סטטוס</TableHead>
                    <TableHead className="text-right font-semibold w-[180px]">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow 
                      key={request.id} 
                      className={cn(
                        "group transition-colors",
                        isRepeatUser(request) && "bg-amber-50/50 dark:bg-amber-950/10",
                        request.status === "pending" && "border-r-4 border-r-amber-400"
                      )}
                    >
                      <TableCell className="py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            {isRepeatUser(request) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-800/50 rounded-full"
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
                              </TooltipProvider>
                            )}
                            {request.notes && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 cursor-help bg-amber-50 border-amber-200 text-amber-700">
                                      <MessageSquare className="w-3 h-3" />
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[300px]">
                                    <p className="whitespace-pre-wrap">{request.notes}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <button
                              onClick={() => handleFilterByUser(request, 'email')}
                              className="hover:underline hover:text-primary transition-colors text-sm font-medium text-right break-all"
                            >
                              {request.email}
                            </button>
                          </div>
                          <button
                            onClick={() => handleFilterByUser(request, 'id_number')}
                            className="text-xs text-muted-foreground hover:underline hover:text-primary transition-colors"
                          >
                            ת.ז: {request.id_number}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm font-medium">{request.course_name}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm text-muted-foreground">{formatShortDate(request.submission_date)}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge
                          variant={request.status === "sent" ? "default" : "secondary"}
                          className={cn(
                            "text-xs font-medium",
                            request.status === "pending" && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                            request.status === "sent" && "bg-green-100 text-green-700 hover:bg-green-100"
                          )}
                        >
                          {request.status === "sent" ? "✓ טופל" : "ממתין"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button 
                            size="sm" 
                            className="h-9" 
                            onClick={() => handleOpenFileSendDialog(request)}
                          >
                            <Send className="w-4 h-4 ml-1" />
                            שלח קבצים
                          </Button>
                          {isTrustedCombination(request) ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-9 px-2 text-green-600 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => handleRemoveTrusted(request)}
                                  >
                                    <ShieldCheck className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>שילוב אמין - לחץ להסרה</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-9 px-2 hover:text-green-600 hover:bg-green-50"
                                    onClick={() => handleMarkAsTrusted(request)}
                                    disabled={isMarkingTrusted}
                                  >
                                    <ShieldCheck className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>סמן כאמין - שליחה אוטומטית בעתיד</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-9 px-3" 
                            onClick={() => toggleStatus(request)}
                          >
                            {request.status === "sent" ? "בטל" : "סמן ✓"}
                          </Button>
                        </div>
                        {request.status === "sent" && request.sent_date && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            נשלח: {formatShortDate(request.sent_date)}
                          </p>
                        )}
                        {isTrustedCombination(request) && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            שילוב אמין
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile & Tablet Cards */}
            <div className="lg:hidden space-y-3">
              {filteredRequests.map((request) => (
                <Card 
                  key={request.id} 
                  className={cn(
                    "overflow-hidden transition-all",
                    isRepeatUser(request) && "border-amber-200 dark:border-amber-800",
                    request.status === "pending" && "border-r-4 border-r-amber-400"
                  )}
                >
                  <CardContent className="p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={request.status === "sent" ? "default" : "secondary"}
                          className={cn(
                            "text-xs font-medium",
                            request.status === "pending" && "bg-amber-100 text-amber-700",
                            request.status === "sent" && "bg-green-100 text-green-700"
                          )}
                        >
                          {request.status === "sent" ? "✓ טופל" : "ממתין"}
                        </Badge>
                        {isRepeatUser(request) && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            משתמש חוזר ({getRepeatCount(request)})
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatShortDate(request.submission_date)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                      <button
                        onClick={() => handleFilterByUser(request, 'email')}
                        className="text-sm font-medium hover:underline hover:text-primary transition-colors block truncate w-full text-right"
                      >
                        {request.email}
                      </button>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">ת.ז: {request.id_number}</span>
                        <Badge variant="outline" className="text-xs">{request.course_name}</Badge>
                      </div>
                    </div>

                    {/* Notes */}
                    {request.notes && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-amber-800 dark:text-amber-200 whitespace-pre-wrap">{request.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t">
                      <Button 
                        size="sm" 
                        className="flex-1 h-10" 
                        onClick={() => handleOpenFileSendDialog(request)}
                      >
                        <Send className="w-4 h-4 ml-1" />
                        שלח קבצים
                      </Button>
                      {isTrustedCombination(request) ? (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-10 px-3 text-green-600 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRemoveTrusted(request)}
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-10 px-3 hover:text-green-600 hover:bg-green-50"
                          onClick={() => handleMarkAsTrusted(request)}
                          disabled={isMarkingTrusted}
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-10 px-4" 
                        onClick={() => toggleStatus(request)}
                      >
                        {request.status === "sent" ? "בטל" : "✓"}
                      </Button>
                    </div>

                    {isTrustedCombination(request) && (
                      <p className="text-xs text-green-600 text-center pt-2 flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        שילוב אמין - שליחה אוטומטית
                      </p>
                    )}

                    {request.status === "sent" && request.sent_date && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        נשלח: {formatShortDate(request.sent_date)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
};

// Date Filters Component
interface DateFiltersProps {
  quickFilter: string;
  handleQuickFilter: (value: string) => void;
  startDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  setQuickFilter: (value: string) => void;
  clearDateFilters: () => void;
}

const DateFilters = ({
  quickFilter,
  handleQuickFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  setQuickFilter,
  clearDateFilters,
}: DateFiltersProps) => (
  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg">
    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
    <Select value={quickFilter} onValueChange={handleQuickFilter}>
      <SelectTrigger className="w-[130px] h-9 bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">כל התאריכים</SelectItem>
        <SelectItem value="today">היום</SelectItem>
        <SelectItem value="week">שבוע אחרון</SelectItem>
        <SelectItem value="month">חודש אחרון</SelectItem>
      </SelectContent>
    </Select>

    <span className="text-sm text-muted-foreground hidden sm:inline">או טווח מותאם:</span>

    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start text-right font-normal bg-background",
            !startDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4" />
          {startDate ? format(startDate, "dd/MM/yy") : "מתאריך"}
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
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>

    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start text-right font-normal bg-background",
            !endDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4" />
          {endDate ? format(endDate, "dd/MM/yy") : "עד תאריך"}
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
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>

    {(startDate || endDate) && (
      <Button
        variant="ghost"
        size="sm"
        onClick={clearDateFilters}
        className="h-9 px-2"
      >
        <X className="h-4 w-4 ml-1" />
        נקה
      </Button>
    )}
  </div>
);

