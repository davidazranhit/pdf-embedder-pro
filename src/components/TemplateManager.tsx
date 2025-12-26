import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildStoragePath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, CheckCircle2, Circle, Settings, Pencil, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

  const defaultCategories = ['בסיסי נתונים', 'מונחה עצמים', 'חישוביות וסיבוכיות'];
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  // Get unique categories from defaults, database categories, and templates
  const categories = Array.from(new Set([...defaultCategories, ...dbCategories, ...templates.map(t => t.category)]));
  
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  
  // Confirmation dialogs state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [pendingEditCategory, setPendingEditCategory] = useState<{ oldName: string; newName: string } | null>(null);
  
  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("name")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return;
    }

    setDbCategories(data?.map(c => c.name) || []);
  };

  useEffect(() => {
    // Set all new categories to collapsed by default
    setCollapsedCategories((prev) => {
      const newCollapsed = { ...prev };
      categories.forEach(cat => {
        if (!(cat in newCollapsed)) {
          newCollapsed[cat] = true;
        }
      });
      return newCollapsed;
    });
  }, [templates.length]);

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

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>, categoryToUse?: string) => {
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
          category: categoryToUse || selectedCategory,
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
      // Reset the input value to allow uploading the same file again
      e.target.value = '';
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "שגיאה",
        description: "אנא הזן שם לקטגוריה",
        variant: "destructive",
      });
      return;
    }
    
    const categoryName = newCategoryName.trim();
    
    // Check if category already exists
    if (categories.includes(categoryName)) {
      toast({
        title: "שגיאה",
        description: "קטגוריה זו כבר קיימת",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Save to database
      const { error } = await supabase
        .from("categories")
        .insert({ name: categoryName });

      if (error) throw error;

      // Update local state
      setDbCategories(prev => [...prev, categoryName]);
      setSelectedCategory(categoryName);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      
      // Expand the new category
      setCollapsedCategories(prev => ({ ...prev, [categoryName]: false }));
      
      toast({
        title: "קטגוריה חדשה נוצרה",
        description: `כעת תוכל להוסיף תבניות לקטגוריה "${categoryName}"`,
      });
    } catch (error) {
      console.error("Error creating category:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן ליצור את הקטגוריה",
        variant: "destructive",
      });
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

  const requestEditCategory = (oldName: string) => {
    if (!editCategoryName.trim()) {
      toast({
        title: "שגיאה",
        description: "אנא הזן שם לקטגוריה",
        variant: "destructive",
      });
      return;
    }

    const newName = editCategoryName.trim();

    if (newName === oldName) {
      setEditingCategory(null);
      setEditCategoryName("");
      return;
    }

    if (categories.includes(newName)) {
      toast({
        title: "שגיאה",
        description: "קטגוריה בשם זה כבר קיימת",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog
    setPendingEditCategory({ oldName, newName });
    setEditConfirmOpen(true);
  };

  const confirmEditCategory = async () => {
    if (!pendingEditCategory) return;

    const { oldName, newName } = pendingEditCategory;

    try {
      // Update category in categories table
      const { error: catError } = await supabase
        .from("categories")
        .update({ name: newName })
        .eq("name", oldName);

      if (catError) throw catError;

      // Update all templates with this category
      const { error: templateError } = await supabase
        .from("pdf_templates")
        .update({ category: newName })
        .eq("category", oldName);

      if (templateError) throw templateError;

      // Update local state
      setDbCategories(prev => prev.map(c => c === oldName ? newName : c));
      setTemplates(prev => prev.map(t => t.category === oldName ? { ...t, category: newName } : t));
      setEditingCategory(null);
      setEditCategoryName("");

      toast({
        title: "קטגוריה עודכנה",
        description: `שם הקטגוריה שונה ל-"${newName}"`,
      });
    } catch (error) {
      console.error("Error updating category:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את הקטגוריה",
        variant: "destructive",
      });
    } finally {
      setEditConfirmOpen(false);
      setPendingEditCategory(null);
    }
  };

  const requestDeleteCategory = (categoryName: string) => {
    const categoryTemplates = templates.filter(t => t.category === categoryName);
    
    if (categoryTemplates.length > 0) {
      toast({
        title: "לא ניתן למחוק",
        description: "יש קבצים בקטגוריה זו. יש להעביר או למחוק אותם קודם.",
        variant: "destructive",
      });
      return;
    }

    setCategoryToDelete(categoryName);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      // Delete from categories table
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("name", categoryToDelete);

      if (error) throw error;

      // Update local state
      setDbCategories(prev => prev.filter(c => c !== categoryToDelete));

      toast({
        title: "קטגוריה נמחקה",
        description: `הקטגוריה "${categoryToDelete}" הוסרה`,
      });
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את הקטגוריה",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת קטגוריה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את הקטגוריה "{categoryToDelete}"?
              <br />
              פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              מחק קטגוריה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Confirmation Dialog */}
      <AlertDialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>שינוי שם קטגוריה</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>האם אתה בטוח שברצונך לשנות את שם הקטגוריה?</div>
              <div className="bg-muted p-3 rounded-lg text-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">שם נוכחי:</span>
                  <span>{pendingEditCategory?.oldName}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-medium">שם חדש:</span>
                  <span className="text-primary">{pendingEditCategory?.newName}</span>
                </div>
              </div>
              <div className="text-sm">כל הקבצים בקטגוריה זו יעודכנו לשם החדש.</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel onClick={() => {
              setEditConfirmOpen(false);
              setPendingEditCategory(null);
            }}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEditCategory}>
              שנה שם
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-foreground">תבניות PDF מוכנות</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button 
              onClick={() => setShowNewCategoryInput(!showNewCategoryInput)} 
              variant="outline" 
              size="sm"
            >
              + קטגוריה חדשה
            </Button>
            <Button 
              onClick={() => setIsManagingCategories(!isManagingCategories)} 
              variant={isManagingCategories ? "default" : "outline"}
              size="sm"
            >
              <Settings className="w-4 h-4 ml-2" />
              {isManagingCategories ? "סיים ניהול" : "נהל קטגוריות"}
            </Button>
          </div>
          
          {showNewCategoryInput && (
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="שם קטגוריה חדשה"
                className="flex-1 px-3 py-2 border rounded bg-background"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddNewCategory();
                  }
                }}
              />
              <Button onClick={handleAddNewCategory} size="sm">
                צור
              </Button>
              <Button 
                onClick={() => {
                  setShowNewCategoryInput(false);
                  setNewCategoryName("");
                }} 
                variant="ghost" 
                size="sm"
              >
                ביטול
              </Button>
            </div>
          )}
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
              
              const allSelected = categoryTemplates.length > 0 && categoryTemplates.every(t => selectedTemplates.some(st => st.id === t.id));
              
              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center justify-between">
                    {editingCategory === category ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          className="px-2 py-1 border rounded bg-background text-foreground"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              requestEditCategory(category);
                            } else if (e.key === 'Escape') {
                              setEditingCategory(null);
                              setEditCategoryName("");
                            }
                          }}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => requestEditCategory(category)}>
                          שמור
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setEditingCategory(null);
                            setEditCategoryName("");
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-foreground">{category}</h4>
                        {isManagingCategories && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCategory(category);
                                setEditCategoryName(category);
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => requestDeleteCategory(category)}
                              className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {categoryTemplates.length > 0 && (
                        <>
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
                        </>
                      )}
                      <div className="relative">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            handleUploadTemplate(e, category);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={isLoading}
                        />
                        <Button disabled={isLoading} size="sm" variant="outline">
                          <Upload className="w-4 h-4 ml-2" />
                          הוסף קובץ
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {!collapsedCategories[category] && categoryTemplates.length > 0 && (
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
                  
                  {!collapsedCategories[category] && categoryTemplates.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p className="text-sm">אין תבניות בקטגוריה זו</p>
                      <p className="text-xs mt-1">לחץ על "הוסף קובץ" למעלה להוספת תבנית</p>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
    </>
  );
};