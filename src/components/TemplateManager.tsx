import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildStoragePath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, CheckCircle2, Circle } from "lucide-react";

interface Template {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  created_at: string;
  category: string;
}

interface TemplateManagerProps {
  onTemplateSelect: (templates: Template[]) => void;
  selectedTemplates: Template[];
}

export const TemplateManager = ({ onTemplateSelect, selectedTemplates }: TemplateManagerProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('בסיסי נתונים');
  const { toast } = useToast();

  const categories = ['בסיסי נתונים', 'מונחה עצמים', 'חישוביות וסיבוכיות'];
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("pdf_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching templates:", error);
      return;
    }

    setTemplates(data || []);
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    const file = files[0];

    try {
      // Upload to storage (with upsert to allow overwriting existing files)
      const fileName = buildStoragePath('templates', file.name);
      const { error: uploadError } = await supabase.storage
        .from("pdf-files")
        .upload(fileName, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Save to database
      const { error: dbError } = await supabase
        .from("pdf_templates")
        .insert({
          name: file.name,
          file_path: fileName,
          file_size: file.size,
          category: selectedCategory,
        });

      if (dbError) throw dbError;

      toast({
        title: "תבנית נוספה בהצלחה",
        description: `${file.name} נוסף למערכת`,
      });

      fetchTemplates();
    } catch (error) {
      console.error("Error uploading template:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן להעלות את התבנית",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("pdf-files")
        .remove([template.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("pdf_templates")
        .delete()
        .eq("id", template.id);

      if (dbError) throw dbError;

      toast({
        title: "תבנית נמחקה",
        description: `${template.name} הוסר מהמערכת`,
      });

      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את התבנית",
        variant: "destructive",
      });
    }
  };

  const toggleTemplateSelection = (template: Template) => {
    const isSelected = selectedTemplates.some((t) => t.id === template.id);
    if (isSelected) {
      onTemplateSelect(selectedTemplates.filter((t) => t.id !== template.id));
    } else {
      onTemplateSelect([...selectedTemplates, template]);
    }
  };

  const selectAllInCategory = (category: string) => {
    const categoryTemplates = templates.filter(t => t.category === category);
    const allSelected = categoryTemplates.every(t => selectedTemplates.some(st => st.id === t.id));
    
    if (allSelected) {
      // Deselect all in category
      onTemplateSelect(selectedTemplates.filter(t => t.category !== category));
    } else {
      // Select all in category
      const newSelections = [...selectedTemplates];
      categoryTemplates.forEach(t => {
        if (!newSelections.some(st => st.id === t.id)) {
          newSelections.push(t);
        }
      });
      onTemplateSelect(newSelections);
    }
  };

  const groupedTemplates = categories.reduce((acc, category) => {
    acc[category] = templates.filter(t => t.category === category);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-foreground">תבניות PDF מוכנות</h3>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="relative">
            <input
              type="file"
              accept=".pdf"
              onChange={handleUploadTemplate}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isLoading}
            />
            <Button disabled={isLoading} size="sm">
              <Upload className="w-4 h-4 ml-2" />
              הוסף תבנית
            </Button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>אין תבניות במערכת</p>
            <p className="text-sm">העלה קובץ PDF להוספת תבנית</p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">לחץ על תבנית כדי לבחור אותה או בחר תיקייה שלמה</p>
            
            {categories.map(category => {
              const categoryTemplates = groupedTemplates[category] || [];
              if (categoryTemplates.length === 0) return null;
              
              const allSelected = categoryTemplates.every(t => selectedTemplates.some(st => st.id === t.id));
              
              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-foreground">{category}</h4>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCategoryCollapse(category)}
                      >
                        {collapsedCategories[category] ? 'הצג' : 'מזער'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllInCategory(category)}
                      >
                        {allSelected ? 'בטל בחירת הכל' : 'בחר הכל'}
                      </Button>
                    </div>
                  </div>
                  
                  {!collapsedCategories[category] && (
                    <div className="grid gap-3 animate-fade-in">
                      {categoryTemplates.map((template) => {
                        const isSelected = selectedTemplates.some((t) => t.id === template.id);
                        return (
                          <div
                            key={template.id}
                            className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer ${
                              isSelected
                                ? "border-primary bg-primary/10 shadow-sm"
                                : "border-border hover:border-primary/50 hover:bg-accent/5"
                            }`}
                            onClick={() => toggleTemplateSelection(template)}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {isSelected ? (
                                <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
                              ) : (
                                <Circle className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                              )}
                              <div className="p-2 rounded bg-primary/10 text-primary">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-foreground">{template.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {(template.file_size / 1024 / 1024).toFixed(2)} MB
                                  {isSelected && " • נבחר להטמעה"}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(template);
                              }}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};