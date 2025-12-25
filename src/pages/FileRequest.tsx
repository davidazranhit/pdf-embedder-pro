import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateIsraeliID } from "@/lib/idValidation";
import { FileText, Send } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Course {
  id: string;
  name: string;
}

const FileRequest = () => {
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [courseName, setCourseName] = useState("");
  const [notes, setNotes] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [formTitle, setFormTitle] = useState("בקשת קבצים");
  const [formInstructions, setFormInstructions] = useState("הוראות למילוי:\n\nעליך להזין מייל ותעודת זהות וקורס מבוקש.\n\nלאחר שליחת הבקשה הפרטים יועברו לבדיקה ולאחר אישור (אין טעם לעדכן ששלחתם את הבקשה, היא תטופל בהקדם) יישלחו הקבצים המבוקשים ישירות למייל עם הפרטים האישיים מוטמעים על הקבצים למניעת שיתוף והפצה.");
  const [formWarning, setFormWarning] = useState("כל ניסיון שיתוף או הפצת הקבצים מהווה הפרה חמורה של זכויות יוצרים ויטופל בהתאם");
  const { toast } = useToast();

  useEffect(() => {
    loadFormTexts();
    loadCourses();
  }, []);

  const loadFormTexts = async () => {
    try {
      const { data, error } = await supabase
        .from("watermark_settings")
        .select("form_title, form_instructions, form_warning")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .single();

      if (error) throw error;

      if (data) {
        setFormTitle(data.form_title ?? "בקשת קבצים");
        setFormInstructions(data.form_instructions ?? "הוראות למילוי:\n\nעליך להזין מייל ותעודת זהות וקורס מבוקש.\n\nלאחר שליחת הבקשה הפרטים יועברו לבדיקה ולאחר אישור (אין טעות לעדכן ששלחתם את הבקשה, היא תטופל בהקדם) יישלחו הקבצים המבוקשים ישירות למייל עם הפרטים האישיים מוטמעים על הקבצים למניעת שיתוף והפצה.");
        setFormWarning(data.form_warning ?? "כל ניסיון שיתוף או הפצת הקבצים מהווה הפרה חמורה של זכויות יוצרים ויטופל בהתאם");
      }
    } catch (error) {
      console.error("Error loading form texts:", error);
    }
  };

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Error loading courses:", error);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !idNumber || !courseName) {
      toast({
        title: "שגיאה",
        description: "אנא מלא את כל השדות הנדרשים",
        variant: "destructive",
      });
      return;
    }

    // Validate Israeli ID
    if (!validateIsraeliID(idNumber)) {
      toast({
        title: "תעודת זהות שגויה",
        description: "אנא הזן תעודת זהות תקינה",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("file_requests").insert({
        email,
        id_number: idNumber,
        course_name: courseName,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "בקשה נשלחה בהצלחה",
        description: "הבקשה שלך התקבלה ותעבור לטיפול בהקדם",
      });

      // Clear form
      setEmail("");
      setIdNumber("");
      setCourseName("");
      setNotes("");
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לשלוח את הבקשה. נסה שנית מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{formTitle}</h1>
          <div className="text-muted-foreground space-y-2 text-sm max-w-md mx-auto">
            <p className="whitespace-pre-wrap">{formInstructions}</p>
            <p className="text-destructive font-semibold">
              {formWarning}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">כתובת מייל</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idNumber">תעודת זהות</Label>
            <Input
              id="idNumber"
              type="text"
              placeholder="123456789"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              required
              maxLength={9}
              dir="ltr"
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="courseName">קורס מבוקש</Label>
            {isLoadingCourses ? (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            ) : courses.length > 0 ? (
              <Select dir="rtl" value={courseName} onValueChange={setCourseName}>
                <SelectTrigger className="w-full text-right [&>span]:text-right">
                  <SelectValue placeholder="בחר קורס" className="text-right" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50" dir="rtl">
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.name} className="text-right justify-end">
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="courseName"
                type="text"
                placeholder="שם הקורס"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                required
                dir="rtl"
                className="text-right"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">הערות (לא חובה)</Label>
            <Textarea
              id="notes"
              placeholder="הערות נוספות..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              dir="rtl"
              className="text-right resize-none"
              rows={3}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            size="lg"
          >
            <Send className="w-4 h-4 ml-2" />
            {isSubmitting ? "שולח..." : "שלח בקשה"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default FileRequest;
