import { useState } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FileList, FileItem } from "@/components/FileList";
import { WatermarkForm } from "@/components/WatermarkForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileCheck, Send } from "lucide-react";

const Index = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
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
    if (!email || !userId) {
      toast({
        title: "שגיאה",
        description: "אנא מלא את כל השדות",
        variant: "destructive",
      });
      return;
    }

    if (files.length === 0) {
      toast({
        title: "שגיאה",
        description: "אנא העלה לפחות קובץ אחד",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    // Simulate processing for now
    toast({
      title: "מעבד קבצים...",
      description: "הקבצים בתהליך הטמעה",
    });

    // TODO: Implement actual watermark processing with backend
    setTimeout(() => {
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "completed" as const }))
      );
      setIsProcessing(false);
      toast({
        title: "הושלם בהצלחה!",
        description: "הקבצים עובדו והוטמעו בהצלחה",
      });
    }, 2000);
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

              {/* Upload Zone */}
              <div>
                <h2 className="text-2xl font-semibold mb-6 text-foreground">
                  העלאת קבצים
                </h2>
                <FileUploadZone onFilesSelected={handleFilesSelected} />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <FileList files={files} onRemove={handleRemoveFile} />
              )}

              {/* Action Buttons */}
              {files.length > 0 && (
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={handleProcess}
                    disabled={isProcessing || !email || !userId}
                    className="flex-1 h-12 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
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
                  <Button
                    variant="outline"
                    disabled={isProcessing}
                    className="h-12"
                  >
                    <Send className="w-5 h-5 ml-2" />
                    שלח למייל
                  </Button>
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
