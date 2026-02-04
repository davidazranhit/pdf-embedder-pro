import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";

interface Course {
  id: string;
  name: string;
  is_active: boolean;
  owner_id: string | null;
}

export const CourseManager = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const { userId, isAdmin, isEditor } = useUserRole();

  useEffect(() => {
    fetchCourses();
  }, [userId]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Error fetching courses:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את רשימת הקורסים",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addCourse = async () => {
    if (!newCourseName.trim()) {
      toast({
        title: "שגיאה",
        description: "אנא הזן שם קורס",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      // Editors add courses with their owner_id, admins can add without owner
      const insertData: { name: string; owner_id?: string } = { 
        name: newCourseName.trim() 
      };
      
      if (isEditor && userId) {
        insertData.owner_id = userId;
      }

      const { data, error } = await supabase
        .from("courses")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      setCourses([...courses, data]);
      setNewCourseName("");
      toast({
        title: "הצלחה",
        description: "הקורס נוסף בהצלחה",
      });
    } catch (error) {
      console.error("Error adding course:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן להוסיף את הקורס",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const toggleCourseActive = async (course: Course) => {
    try {
      const { error } = await supabase
        .from("courses")
        .update({ is_active: !course.is_active })
        .eq("id", course.id);

      if (error) throw error;

      setCourses(courses.map(c => 
        c.id === course.id ? { ...c, is_active: !c.is_active } : c
      ));

      toast({
        title: "עודכן",
        description: course.is_active ? "הקורס הוסתר מהטופס" : "הקורס מוצג בטופס",
      });
    } catch (error) {
      console.error("Error updating course:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את הקורס",
        variant: "destructive",
      });
    }
  };

  const deleteCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);

      if (error) throw error;

      setCourses(courses.filter(c => c.id !== courseId));
      toast({
        title: "נמחק",
        description: "הקורס נמחק בהצלחה",
      });
    } catch (error) {
      console.error("Error deleting course:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את הקורס",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">טוען...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newCourseName}
          onChange={(e) => setNewCourseName(e.target.value)}
          placeholder="שם הקורס החדש"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCourse();
            }
          }}
        />
        <Button onClick={addCourse} disabled={isAdding}>
          <Plus className="w-4 h-4 ml-2" />
          {isAdding ? "מוסיף..." : "הוסף"}
        </Button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {courses.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            לא הוגדרו קורסים עדיין
          </p>
        ) : (
          courses.map((course) => (
            <div
              key={course.id}
              className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                course.is_active 
                  ? "bg-background hover:bg-muted/30" 
                  : "bg-muted/50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <span className={course.is_active ? "" : "line-through"}>
                  {course.name}
                </span>
                {!course.is_active && (
                  <Badge variant="secondary" className="text-xs">
                    מוסתר
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleCourseActive(course)}
                >
                  {course.is_active ? "הסתר" : "הצג"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteCourse(course.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
