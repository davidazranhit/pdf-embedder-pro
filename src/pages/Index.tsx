import { useState, useEffect } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FileList, FileItem } from "@/components/FileList";
import { WatermarkForm } from "@/components/WatermarkForm";
import { TemplateManager } from "@/components/TemplateManager";
import { FileRequestsManager } from "@/components/FileRequestsManager";
import { LogoutButton } from "@/components/LogoutButton";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildStoragePath } from "@/lib/utils";
import { FileCheck, Send, Download, User, Inbox, Settings } from "lucide-react";

interface Template {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  created_at: string;
  category: string;
}

const Index = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Template[]>([]);
  const [processedFiles, setProcessedFiles] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendWithoutWatermark, setSendWithoutWatermark] = useState(false);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"single" | "requests">("single");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const emailParam = searchParams.get('email');
    const idParam = searchParams.get('id');

    if (tabParam === 'single' || tabParam === 'requests') {
      setActiveTab(tabParam);
    }
    if (emailParam) setEmail(emailParam);
    if (idParam) setUserId(idParam);
  }, [searchParams]);

  const handleFilesSelected = (newFiles: File[]) => {
    const fileItems: FileItem[] = newFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      status: "pending" as const,
      source: "upload" as const,
    }));
    setFiles((prev) => [...prev, ...fileItems]);
    toast({
      title: "קבצים נוספו",
      description: `${newFiles.length} קבצים נוספו לרשימה`,
    });
  };

  const handleTemplateSelect = (templates: Template[]) => {
    setSelectedTemplates(templates);
    
    // Remove old template files from the list
    setFiles((prev) => prev.filter((f) => f.source !== "template"));
    
    // Add selected templates to files list
    const templateFiles: FileItem[] = templates.map((template) => ({
      id: template.id,
      name: template.name,
      size: template.file_size,
      status: "pending" as const,
      source: "template" as const,
      templatePath: template.file_path,
    }));
    
    setFiles((prev) => [...prev, ...templateFiles]);
  };

  const handleClearAll = () => {
    setFiles([]);
    setSelectedTemplates([]);
    setProcessedFiles([]);
    toast({
      title: "רשימה נוקתה",
      description: "כל הקבצים הוסרו מהרשימה",
    });
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleProcess = async () => {
    console.log("handleProcess called", { email, userId, filesCount: files.length });
    
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
        description: "אנא העלה קבצים או בחר תבניות",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setFiles((prev) => prev.map((f) => ({ ...f, status: "processing" as const })));

    try {
      const allFileIds: string[] = [];
      
      // Upload user files and collect template paths
      console.log("Processing files...");
      for (const fileItem of files) {
        if (fileItem.source === "upload" && fileItem.file) {
          // Upload user file
          const fileName = buildStoragePath('uploads', fileItem.file.name);
          console.log("Uploading file:", fileName);
          const { error: uploadError } = await supabase.storage
            .from("pdf-files")
            .upload(fileName, fileItem.file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }
          allFileIds.push(fileName);
        } else if (fileItem.source === "template" && fileItem.templatePath) {
          // Use template path directly
          allFileIds.push(fileItem.templatePath);
        }
      }
      
      console.log("All file IDs to process:", allFileIds);

      if (allFileIds.length === 0) {
        toast({
          title: "שגיאה",
          description: "לא נמצאו קבצים לעיבוד",
          variant: "destructive",
        });
        setIsProcessing(false);
        setFiles((prev) => prev.map((f) => ({ ...f, status: "error" as const })));
        return;
      }

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
    // Determine which files to send
    let fileIdsToSend: string[] = [];
    
    if (sendWithoutWatermark) {
      // Send original files
      if (files.length === 0) {
        toast({
          title: "שגיאה",
          description: "אין קבצים לשליחה",
          variant: "destructive",
        });
        return;
      }
      
      // Collect original file paths
      for (const fileItem of files) {
        if (fileItem.source === "template" && fileItem.templatePath) {
          fileIdsToSend.push(fileItem.templatePath);
        } else if (fileItem.source === "upload" && fileItem.file) {
          // Need to upload first if not already uploaded
          const fileName = buildStoragePath('uploads', fileItem.file.name);
          const { error: uploadError } = await supabase.storage
            .from("pdf-files")
            .upload(fileName, fileItem.file, { upsert: true });
          
          if (!uploadError) {
            fileIdsToSend.push(fileName);
          }
        }
      }
    } else {
      // Send processed files
      if (processedFiles.length === 0) {
        toast({
          title: "שגיאה",
          description: "אין קבצים מעובדים לשליחה. הטמע Watermarks תחילה.",
          variant: "destructive",
        });
        return;
      }
      fileIdsToSend = processedFiles;
    }

    if (fileIdsToSend.length === 0) {
      toast({
        title: "שגיאה",
        description: "לא נמצאו קבצים לשליחה",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-watermarked-files", {
        body: { email, fileIds: fileIdsToSend },
      });

      if (error) throw error;

      toast({
        title: "נשלח בהצלחה!",
        description: `${fileIdsToSend.length} קבצים נשלחו ל-${email}`,
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
    // Determine which files to download
    let fileIdsToDownload: string[] = [];
    
    if (sendWithoutWatermark) {
      // Download original files
      if (files.length === 0) {
        toast({
          title: "שגיאה",
          description: "אין קבצים להורדה",
          variant: "destructive",
        });
        return;
      }
      
      // Collect original file paths
      for (const fileItem of files) {
        if (fileItem.source === "template" && fileItem.templatePath) {
          fileIdsToDownload.push(fileItem.templatePath);
        } else if (fileItem.source === "upload" && fileItem.file) {
          // Need to upload first if not already uploaded
          const fileName = buildStoragePath('uploads', fileItem.file.name);
          const { error: uploadError } = await supabase.storage
            .from("pdf-files")
            .upload(fileName, fileItem.file, { upsert: true });
          
          if (!uploadError) {
            fileIdsToDownload.push(fileName);
          }
        }
      }
    } else {
      // Download processed files
      if (processedFiles.length === 0) {
        toast({
          title: "שגיאה",
          description: "אין קבצים מעובדים להורדה",
          variant: "destructive",
        });
        return;
      }
      fileIdsToDownload = processedFiles;
    }

    if (fileIdsToDownload.length === 0) {
      toast({
        title: "שגיאה",
        description: "לא נמצאו קבצים להורדה",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const filePath of fileIdsToDownload) {
        const { data, error } = await supabase.storage
          .from("pdf-files")
          .download(filePath);

        if (error) throw error;

        // Extract the filename from the path (already includes userId)
        const fileName = filePath.split("/").pop() || "document.pdf";

        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: "הורדה החלה",
        description: `מוריד ${fileIdsToDownload.length} קבצים`,
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

  const handleManualEmail = async () => {
    // Determine which files to send
    let fileIdsToSend: string[] = [];
    
    if (sendWithoutWatermark) {
      // Send original files
      if (files.length === 0) {
        toast({
          title: "שגיאה",
          description: "אין קבצים לשליחה",
          variant: "destructive",
        });
        return;
      }
      
      // Collect original file paths
      for (const fileItem of files) {
        if (fileItem.source === "template" && fileItem.templatePath) {
          fileIdsToSend.push(fileItem.templatePath);
        } else if (fileItem.source === "upload" && fileItem.file) {
          // Need to upload first if not already uploaded
          const fileName = buildStoragePath('uploads', fileItem.file.name);
          const { error: uploadError } = await supabase.storage
            .from("pdf-files")
            .upload(fileName, fileItem.file, { upsert: true });
          
          if (!uploadError) {
            fileIdsToSend.push(fileName);
          }
        }
      }
    } else {
      // Send processed files
      if (processedFiles.length === 0) {
        toast({
          title: "שגיאה",
          description: "אין קבצים מעובדים. הטמע Watermarks תחילה.",
          variant: "destructive",
        });
        return;
      }
      fileIdsToSend = processedFiles;
    }

    if (fileIdsToSend.length === 0) {
      toast({
        title: "שגיאה",
        description: "לא נמצאו קבצים לשליחה",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create signed URLs for all files
      const links: { name: string; url: string }[] = [];

      for (const fileId of fileIdsToSend) {
        const processedFileName = fileId.split('/').pop() || 'document.pdf';
        const fileNameWithoutUserId = processedFileName.replace(/_[^_]+\.pdf$/, '.pdf');
        
        const { data: templateData } = await supabase
          .from('pdf_templates')
          .select('name, file_path')
          .ilike('file_path', `%${fileNameWithoutUserId}%`)
          .maybeSingle();

        let finalFileName = processedFileName;
        if (templateData?.name) {
          // Use exact system name (preserve Hebrew and spaces)
          finalFileName = templateData.name.endsWith('.pdf') ? templateData.name : `${templateData.name}.pdf`;
        } else {
          // Uploaded file without template match: use original base name without userId suffix
          finalFileName = processedFileName.replace(/_[^_]+\.pdf$/i, '.pdf');
        }

        const { data: signed, error: signedError } = await supabase.storage
          .from('pdf-files')
          .createSignedUrl(fileId, 60 * 60 * 24 * 3);

        if (signedError || !signed?.signedUrl) {
          console.error('Error creating signed URL for', fileId, signedError);
          continue;
        }

        // Ensure the URL is absolute and force download filename
        const baseUrl = signed.signedUrl.startsWith('http') 
          ? signed.signedUrl 
          : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${signed.signedUrl}`;
        const delimiter = baseUrl.includes('?') ? '&' : '?';
        const finalUrl = `${baseUrl}${delimiter}download=${encodeURIComponent(finalFileName)}`;

        links.push({ name: finalFileName, url: finalUrl });
      }

      if (links.length === 0) {
        toast({
          title: "שגיאה",
          description: "לא ניתן ליצור קישורים להורדה",
          variant: "destructive",
        });
        return;
      }

      // Create HTML email body with hyperlinks
      const htmlBody = `<div dir="rtl">
<p>שלום,</p>
<p>מצורפים הקבצים שלך לקורס.</p>
<p>הקבצים מותאמים אישית עבורך – עם הפרטים שלך – והם נועדו לשימוש אישי בלבד.</p>
<p>חשוב לדעת: כל שיתוף או העתקה של הקבצים נחשבים להפרה חמורה של זכויות יוצרים, ויגררו השלכות בהתאם.</p>
<p>קבצים להורדה (זמינים ל-3 ימים):</p>
${links.map((l) => {
  return `<p>• <a href="${l.url}">${l.name}</a></p>`;
}).join('\n')}
<p>בהצלחה בקורס!</p>
</div>`;

      // Only copy to clipboard when explicitly triggered by the button
      try {
        const blob = new Blob([htmlBody], { type: 'text/html' });
        const data = [new ClipboardItem({ 'text/html': blob })];
        await navigator.clipboard.write(data);
      } catch (clipboardError) {
        console.error("Clipboard error:", clipboardError);
        // Continue even if clipboard fails
      }

      // Open Gmail compose
      const mailtoLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent("קבצים מהקורס")}`;
      window.open(mailtoLink, "_blank");

      toast({
        title: "מייל מוכן",
        description: "Gmail נפתח והתוכן הועתק ללוח - הדבק בגוף המייל (Ctrl+V)",
      });
    } catch (error) {
      console.error("Manual email error:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן להכין את המייל",
        variant: "destructive",
      });
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Link to="/sys-admin/settings">
                <Button variant="outline" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  הגדרות
                </Button>
              </Link>
              <LogoutButton />
            </div>
            <div className="text-center">
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
          </div>

          {/* Main Card with Tabs */}
          <Card className="p-8 shadow-lg border-border/50">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "single" | "requests")} dir="rtl">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="single" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  משתמש בודד
                </TabsTrigger>
                <TabsTrigger value="requests" className="flex items-center gap-2">
                  <Inbox className="w-4 h-4" />
                  בקשות לקבצים
                </TabsTrigger>
              </TabsList>

              {/* Single User Tab */}
              <TabsContent value="single" className="space-y-8">
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
                    sendWithoutWatermark={sendWithoutWatermark}
                    onSendWithoutWatermarkChange={setSendWithoutWatermark}
                  />
                </div>

                {/* Template Manager */}
                <TemplateManager
                  onTemplateSelect={handleTemplateSelect}
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
                  <FileList 
                    files={files} 
                    onRemove={handleRemoveFile}
                    onClearAll={handleClearAll}
                  />
                )}

                {/* Action Buttons */}
                {files.length > 0 && (
                  <div className="space-y-4">
                    {!sendWithoutWatermark && (
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
                    )}

                    {(processedFiles.length > 0 || sendWithoutWatermark) && (
                      <div className="space-y-3">
                        <Button
                          onClick={handleDownloadAll}
                          variant="outline"
                          className="w-full h-12"
                        >
                          <Download className="w-5 h-5 ml-2" />
                          הורד קבצים
                        </Button>
                        <div className="flex gap-4">
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
                                שלח אוטומטית
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={handleManualEmail}
                            variant="outline"
                            className="flex-1 h-12"
                          >
                            <Send className="w-5 h-5 ml-2" />
                            שלח ידנית (Gmail)
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* File Requests Tab */}
              <TabsContent value="requests" className="space-y-8">
                <FileRequestsManager />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
