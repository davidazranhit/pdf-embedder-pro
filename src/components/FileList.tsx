import { FileText, X, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FileItem {
  file?: File;
  id: string;
  name: string;
  size: number;
  status: "pending" | "processing" | "completed" | "error";
  source: "upload" | "template";
  templatePath?: string; // Storage path for templates
}

interface FileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
}

export const FileList = ({ files, onRemove, onClearAll }: FileListProps) => {
  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          קבצים להטמעה ({files.length})
        </h3>
        {onClearAll && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            נקה הכל
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {files.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded bg-primary/10 text-primary flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {item.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(item.size / 1024 / 1024).toFixed(2)} MB
                  {item.source === "template" && " • מתבנית"}
                </p>
              </div>
              {item.status === "completed" && (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              )}
              {item.status === "processing" && (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
            </div>
            {item.status === "pending" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(item.id)}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
