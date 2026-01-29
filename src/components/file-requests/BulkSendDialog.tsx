import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FileText, Send, Check, Eye, Users, Mail, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

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

interface BulkSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRequests: FileRequest[];
  templates: Template[];
  categories: Category[];
  onSend: (requests: FileRequest[], templateIds: string[]) => Promise<void>;
  isSending: boolean;
  sendProgress: { current: number; total: number; currentEmail?: string };
}

export const BulkSendDialog = ({
  open,
  onOpenChange,
  selectedRequests,
  templates,
  categories,
  onSend,
  isSending,
  sendProgress,
}: BulkSendDialogProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isFileListExpanded, setIsFileListExpanded] = useState(false);

  // Get unique courses from selected requests
  const uniqueCourses = [...new Set(selectedRequests.map(r => r.course_name))];
  const hasMultipleCourses = uniqueCourses.length > 1;

  // Filter templates by category
  const filteredTemplates = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : [];

  // Auto-select category when dialog opens
  useEffect(() => {
    if (open && selectedRequests.length > 0) {
      // If all requests are same course, auto-select that category
      if (!hasMultipleCourses) {
        const matchingCategory = categories.find(c => c.name === uniqueCourses[0]);
        if (matchingCategory) {
          setSelectedCategory(matchingCategory.name);
          const categoryTemplates = templates.filter(t => t.category === matchingCategory.name);
          setSelectedFileIds(new Set(categoryTemplates.map(t => t.id)));
        }
      } else {
        setSelectedCategory("");
        setSelectedFileIds(new Set());
      }
      setIsFileListExpanded(false);
    }
  }, [open, selectedRequests]);

  // Update file selection when category changes
  useEffect(() => {
    if (selectedCategory) {
      const categoryTemplates = templates.filter(t => t.category === selectedCategory);
      setSelectedFileIds(new Set(categoryTemplates.map(t => t.id)));
    }
  }, [selectedCategory, templates]);

  const handleToggleFile = (fileId: string) => {
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
    if (selectedFileIds.size === filteredTemplates.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredTemplates.map((t) => t.id)));
    }
  };

  const handleSend = () => {
    const selectedTemplateIds = Array.from(selectedFileIds);
    onSend(selectedRequests, selectedTemplateIds);
  };

  const handleClose = () => {
    if (!isSending) {
      onOpenChange(false);
      setSelectedCategory("");
      setSelectedFileIds(new Set());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Users className="w-5 h-5" />
            שליחה מרובה
          </DialogTitle>
          <DialogDescription>
            שלח קבצים ל-{selectedRequests.length} בקשות בבת אחת
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Warning for multiple courses */}
          {hasMultipleCourses && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  הבקשות הנבחרות מכילות קורסים שונים
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  קורסים: {uniqueCourses.join(", ")}
                </p>
                <p className="text-xs text-destructive/80">
                  בחר קטגוריה אחת - אותם קבצים יישלחו לכל הבקשות
                </p>
              </div>
            </div>
          )}

          {/* Selected requests summary */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">נמענים נבחרים:</span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto">
              {selectedRequests.map((req) => (
                <Badge key={req.id} variant="secondary" className="text-xs">
                  {req.email}
                </Badge>
              ))}
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">בחר קטגוריה</label>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
              disabled={isSending}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="בחר קטגוריה..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.name} value={category.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{category.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {category.count} קבצים
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Summary & Selection */}
          {selectedCategory && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    {selectedFileIds.size === filteredTemplates.length
                      ? `כל ${filteredTemplates.length} הקבצים נבחרו`
                      : `${selectedFileIds.size} מתוך ${filteredTemplates.length} קבצים נבחרו`}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFileListExpanded(!isFileListExpanded)}
                  className="gap-1"
                  disabled={isSending}
                >
                  <Eye className="w-4 h-4" />
                  {isFileListExpanded ? "הסתר" : "בחר קבצים"}
                </Button>
              </div>

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
                      disabled={isSending}
                    >
                      {selectedFileIds.size === filteredTemplates.length ? "בטל הכל" : "בחר הכל"}
                    </Button>
                  </div>
                  <div className="border rounded-xl max-h-[200px] overflow-y-auto divide-y bg-background">
                    {filteredTemplates.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>אין קבצים בקטגוריה זו</p>
                      </div>
                    ) : (
                      filteredTemplates.map((template) => (
                        <div
                          key={template.id}
                          className={cn(
                            "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-all",
                            selectedFileIds.has(template.id) && "bg-primary/5 hover:bg-primary/10",
                            isSending && "opacity-50 cursor-not-allowed"
                          )}
                          onClick={() => !isSending && handleToggleFile(template.id)}
                        >
                          <Checkbox
                            checked={selectedFileIds.has(template.id)}
                            disabled={isSending}
                          />
                          <FileText
                            className={cn(
                              "w-4 h-4",
                              selectedFileIds.has(template.id) ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                          <span className="flex-1 text-sm truncate">{template.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {isSending && (
            <div className="space-y-3 p-4 bg-primary/5 rounded-xl">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">מעבד בקשות...</span>
                <span className="text-muted-foreground">
                  {sendProgress.current} / {sendProgress.total}
                </span>
              </div>
              <Progress value={(sendProgress.current / sendProgress.total) * 100} />
              {sendProgress.currentEmail && (
                <p className="text-xs text-muted-foreground truncate">
                  שולח אל: {sendProgress.currentEmail}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isSending}>
              ביטול
            </Button>
            <Button
              onClick={handleSend}
              disabled={selectedFileIds.size === 0 || isSending}
              className="min-w-[160px]"
            >
              {isSending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  מעבד...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  שלח ל-{selectedRequests.length} בקשות
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
