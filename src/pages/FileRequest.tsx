import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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

// Admin user ID - requests from /request-access go to this user
const ADMIN_USER_ID = "c7a6bf76-9455-4891-9570-9aa6fb69bd87";

interface Course {
  id: string;
  name: string;
  owner_id: string | null;
}

const FileRequest = () => {
  const { editorId } = useParams<{ editorId?: string }>();
  
  // Determine the target owner - either specific editor or admin
  const targetOwnerId = editorId || ADMIN_USER_ID;
  
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [courseName, setCourseName] = useState("");
  const [notes, setNotes] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [editorNotFound, setEditorNotFound] = useState(false);
  const [formTitle, setFormTitle] = useState("בקשת קבצים");
  const [formInstructions, setFormInstructions] = useState("הוראות למילוי:\n\nעליך להזין מייל ותעודת זהות וקורס מבוקש.\n\nלאחר שליחת הבקשה הפרטים יועברו לבדיקה ולאחר אישור (אין טעם לעדכן ששלחתם את הבקשה, היא תטופל בהקדם) יישלחו הקבצים המבוקשים ישירות למייל עם הפרטים האישיים מוטמעים על הקבצים למניעת שיתוף והפצה.");
  const [formWarning, setFormWarning] = useState("כל ניסיון שיתוף או הפצת הקבצים מהווה הפרה חמורה של זכויות יוצרים ויטופל בהתאם");
  const { toast } = useToast();

  const normalizeEmail = (value: string) => value.trim();

  const normalizeIsraeliId = (value: string) => {
    const digits = value.replace(/\D/g, "");
    // Align with validateIsraeliID expectation (9 digits)
    return digits.padStart(9, "0").slice(-9);
  };

  const normalizeCourseName = (value: string) => value.trim();

  useEffect(() => {
    loadFormTexts();
    loadCourses();
  }, [targetOwnerId]);

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
      // Load courses for the specific owner (editor or admin)
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, owner_id")
        .eq("is_active", true)
        .eq("owner_id", targetOwnerId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // If editor specified but no courses found, check if editor exists
      if (editorId && (!data || data.length === 0)) {
        // Check if there are ANY courses for this editor (even inactive)
        const { data: anyCoursesData } = await supabase
          .from("courses")
          .select("id")
          .eq("owner_id", targetOwnerId)
          .limit(1);
        
        if (!anyCoursesData || anyCoursesData.length === 0) {
          // No courses at all for this editor - might be invalid link
          setEditorNotFound(true);
        }
      }
      
      setCourses(data || []);
    } catch (error) {
      console.error("Error loading courses:", error);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = normalizeEmail(email);
    const normalizedIdNumber = normalizeIsraeliId(idNumber);
    const normalizedCourseName = normalizeCourseName(courseName);
    const normalizedNotes = notes.trim();

    if (!normalizedEmail || !normalizedIdNumber || !normalizedCourseName) {
      toast({
        title: "שגיאה",
        description: "אנא מלא את כל השדות הנדרשים",
        variant: "destructive",
      });
      return;
    }

    // Validate Israeli ID
    if (!validateIsraeliID(normalizedIdNumber)) {
      toast({
        title: "תעודת זהות שגויה",
        description: "אנא הזן תעודת זהות תקינה",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the target owner ID (from URL or admin default)
      const ownerId = targetOwnerId;

      // Insert the request with owner_id to route to correct editor
      const { data: insertedRequest, error } = await supabase
        .from("file_requests")
        .insert({
          email: normalizedEmail,
          id_number: normalizedIdNumber,
          course_name: normalizedCourseName,
          notes: normalizedNotes || null,
          owner_id: ownerId,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Notify admin if pending threshold exceeded
      try {
        await supabase.functions.invoke("notify-pending-requests");
      } catch (notifyError) {
        console.error("Notify admin failed:", notifyError);
        // Don't block on notification failure
      }

      // Check if this is a trusted combination and auto-send if so
      try {
        const { data: autoSendResult } = await supabase.functions.invoke("auto-send-trusted", {
          body: {
            email: normalizedEmail,
            id_number: normalizedIdNumber,
            course_name: normalizedCourseName,
            request_id: insertedRequest.id,
          },
        });

        if (autoSendResult?.trusted && autoSendResult?.sent) {
          toast({
            title: "הקבצים נשלחו אוטומטית! 🎉",
            description: `${autoSendResult.fileCount} קבצים נשלחו למייל שלך`,
          });
        } else {
          toast({
            title: "בקשה נשלחה בהצלחה",
            description: "הבקשה שלך התקבלה ותעבור לטיפול בהקדם",
          });
        }
      } catch (autoSendError) {
        console.error("Auto-send check failed:", autoSendError);
        // Still show success - the request was saved
        toast({
          title: "בקשה נשלחה בהצלחה",
          description: "הבקשה שלך התקבלה ותעבור לטיפול בהקדם",
        });
      }

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

  // Show error if editor not found
  if (editorNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/5 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">הדף לא נמצא</h1>
          <p className="text-muted-foreground">
            הקישור שהשתמשת בו אינו תקף או שהעורך אינו קיים במערכת.
          </p>
        </Card>
      </div>
    );
  }

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
              onBlur={() => setEmail((v) => normalizeEmail(v))}
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
              onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
              onBlur={() => setIdNumber((v) => normalizeIsraeliId(v))}
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
                onBlur={() => setCourseName((v) => normalizeCourseName(v))}
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
