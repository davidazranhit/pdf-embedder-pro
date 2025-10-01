import { useState } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FileList, FileItem } from "@/components/FileList";
import { WatermarkForm } from "@/components/WatermarkForm";
import { TemplateManager } from "@/components/TemplateManager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileCheck, Send, Download } from "lucide-react";

interface Template {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

const Index = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Template[]>([]);
  const [processedFiles, setProcessedFiles] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = (newFiles: File[]) => {
    const fileItems: FileItem[] = newFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substring(7),
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...fileItems]);
    toast({
      title: "קבצים נוספו",
      description: `${newFiles.length} קבצים נוספו לרשימה`,
    });
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleProcess = async () => {
    console.log("handleProcess called", { email, userId, filesCount: files.length, templatesCount: selectedTemplates.length });
    
    if (!email || !userId) {
      toast({
        title: "שגיאה",
        description: "אנא מלא את כל השדות",
        variant: "destructive",
      });
      return;
    }

    const totalItems = files.length + selectedTemplates.length;
    if (totalItems === 0) {
      toast({
        title: "שגיאה",
        description: "אנא העלה קבצים או בחר תבניות",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setFiles((prev) => prev.map((f) => ({ ...f, status: "processing" as const })));

    try {
      // Upload user files first
      const uploadedFileIds: string[] = [];
      console.log("Starting file upload...");
      for (const fileItem of files) {
        const fileName = `uploads/${Date.now()}_${fileItem.file.name}`;
        console.log("Uploading file:", fileName);
        const { error: uploadError } = await supabase.storage
          .from("pdf-files")
          .upload(fileName, fileItem.file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }
        uploadedFileIds.push(fileName);
      }
      console.log("Uploaded files:", uploadedFileIds);

      // Combine uploaded files with selected templates
      const allFileIds = [
        ...uploadedFileIds,
        ...selectedTemplates.map((t) => t.file_path),
      ];
      console.log("All file IDs to process:", allFileIds);

      // Process watermarks
      console.log("Invoking process-watermark function...");
      const { data, error } = await supabase.functions.invoke("process-watermark", {
        body: { fileIds: allFileIds, email, userId },
      });

      console.log("Process watermark response:", { data, error });
      if (error) throw error;

      const processed = data.files.map((f: any) => f.processedId);
      setProcessedFiles(processed);
      
      setFiles((prev) => prev.map((f) => ({ ...f, status: "completed" as const })));
      
      toast({
        title: "הושלם בהצלחה!",
        description: `${processed.length} קבצים עובדו והוטמעו`,
      });
    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "שגיאה בעיבוד",
        description: "אירעה שגיאה בעת עיבוד הקבצים",
        variant: "destructive",
      });
      setFiles((prev) => prev.map((f) => ({ ...f, status: "error" as const })));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendEmail = async () => {
    if (processedFiles.length === 0) {
      toast({
        title: "שגיאה",
        description: "אין קבצים מעובדים לשליחה",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-watermarked-files", {
        body: { email, fileIds: processedFiles },
      });

      if (error) throw error;

      toast({
        title: "נשלח בהצלחה!",
        description: `הקבצים נשלחו ל-${email}`,
      });
    } catch (error) {
      console.error("Send error:", error);
      toast({
        title: "שגיאה בשליחה",
        description: "לא ניתן לשלוח את הקבצים במייל",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadAll = async () => {
    if (processedFiles.length === 0) {
      toast({
        title: "שגיאה",
        description: "אין קבצים מעובדים להורדה",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const filePath of processedFiles) {
        const { data, error } = await supabase.storage
          .from("pdf-files")
          .download(filePath);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = filePath.split("/").pop() || "document.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: "הורדה החלה",
        description: `מוריד ${processedFiles.length} קבצים`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "שגיאה בהורדה",
        description: "לא ניתן להוריד את הקבצים",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-block p-3 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
              <FileCheck className="w-12 h-12 text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              מערכת הטמעת Watermarks
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              העלה קבצי PDF, הזן את פרטי ההטמעה, והמערכת תטפל בשאר
            </p>
          </div>

          {/* Main Card */}
          <Card className="p-8 shadow-lg border-border/50">
            <div className="space-y-8">
              {/* Form */}
              <div>
                <h2 className="text-2xl font-semibold mb-6 text-foreground">
                  פרטי הטמעה
                </h2>
                <WatermarkForm
                  email={email}
                  userId={userId}
                  onEmailChange={setEmail}
                  onUserIdChange={setUserId}
                />
              </div>

              {/* Template Manager */}
              <TemplateManager
                onTemplateSelect={setSelectedTemplates}
                selectedTemplates={selectedTemplates}
              />

              {/* Upload Zone */}
              <div>
                <h2 className="text-2xl font-semibold mb-6 text-foreground">
                  העלאת קבצים נוספים
                </h2>
                <FileUploadZone onFilesSelected={handleFilesSelected} />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <FileList files={files} onRemove={handleRemoveFile} />
              )}

              {/* Action Buttons */}
              {(files.length > 0 || selectedTemplates.length > 0) && (
                <div className="space-y-4">
                  <Button
                    onClick={handleProcess}
                    disabled={isProcessing || !email || !userId}
                    className="w-full h-12 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin ml-2" />
                        מעבד...
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-5 h-5 ml-2" />
                        הטמע Watermarks
                      </>
                    )}
                  </Button>

                  {processedFiles.length > 0 && (
                    <div className="flex gap-4">
                      <Button
                        onClick={handleDownloadAll}
                        variant="outline"
                        className="flex-1 h-12"
                      >
                        <Download className="w-5 h-5 ml-2" />
                        הורד קבצים
                      </Button>
                      <Button
                        onClick={handleSendEmail}
                        disabled={isSending}
                        variant="outline"
                        className="flex-1 h-12"
                      >
                        {isSending ? (
                          <>
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin ml-2" />
                            שולח...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5 ml-2" />
                            שלח למייל
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
