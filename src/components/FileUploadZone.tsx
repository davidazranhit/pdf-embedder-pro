import { Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export const FileUploadZone = ({ onFilesSelected }: FileUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const validateFiles = (files: FileList | File[]): File[] => {
    const validFiles: File[] = [];
    const fileArray = Array.from(files);

    fileArray.forEach((file) => {
      if (file.type === "application/pdf") {
        validFiles.push(file);
      } else {
        toast({
          title: "קובץ לא תקין",
          description: `${file.name} אינו קובץ PDF`,
          variant: "destructive",
        });
      }
    });

    return validFiles;
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = validateFiles(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected, toast]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const files = validateFiles(e.target.files);
        if (files.length > 0) {
          onFilesSelected(files);
        }
      }
    },
    [onFilesSelected, toast]
  );

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all ${
        isDragging
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-border hover:border-primary/50"
      }`}
    >
      <input
        type="file"
        multiple
        accept=".pdf"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        id="file-upload"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground mb-2">
            גרור קבצי PDF לכאן או לחץ לבחירה
          </p>
          <p className="text-sm text-muted-foreground">
            ניתן לבחור מספר קבצים בו זמנית
          </p>
        </div>
      </div>
    </div>
  );
};
