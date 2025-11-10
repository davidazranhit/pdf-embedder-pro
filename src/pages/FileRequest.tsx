import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateIsraeliID } from "@/lib/idValidation";
import { FileText, Send } from "lucide-react";

const FileRequest = () => {
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [courseName, setCourseName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !idNumber || !courseName) {
      toast({
        title: "שגיאה",
        description: "אנא מלא את כל השדות",
        variant: "destructive",
      });
      return;
    }

    // Validate Israeli ID
    if (!validateIsraeliID(idNumber)) {
      toast({
        title: "תעודת זהות שגויה",
        description: "אנא הזן תעודת זהות ישראלית תקינה (9 ספרות)",
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
          <h1 className="text-3xl font-bold text-foreground">בקשת קבצים</h1>
          <div className="text-muted-foreground space-y-2 text-sm max-w-md mx-auto">
            <p className="font-semibold text-base">הוראות למילוי:</p>
            <p>עליך להזין מייל ותעודת זהות וקורס מבוקש.</p>
            <p>
              לאחר אישור הבקשה יישלחו הקבצים המבוקשים ישירות למייל עם הפרטים האישיים 
              מוטמעים על הקבצים למניעת שיתוף והפצה.
            </p>
            <p className="text-destructive font-semibold">
              כל ניסיון שיתוף או הפצת הקבצים מהווה הפרה חמורה של זכויות יוצרים ויטופל בהתאם
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

        <p className="text-xs text-center text-muted-foreground">
          לאחר שליחת הבקשה, תקבל את הקבצים למייל שהזנת
        </p>
      </Card>
    </div>
  );
};

export default FileRequest;
