import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Send } from "lucide-react";

const FileRequest = () => {
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !idNumber) {
      toast({
        title: "שגיאה",
        description: "אנא מלא את כל השדות",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("file_requests").insert({
        email,
        id_number: idNumber,
      });

      if (error) throw error;

      toast({
        title: "בקשה נשלחה בהצלחה",
        description: "הבקשה שלך התקבלה ותעבור לטיפול בהקדם",
      });

      // Clear form
      setEmail("");
      setIdNumber("");
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
          <p className="text-muted-foreground">
            הזן את כתובת המייל איתה נרשמת לקורס ואת תעודת הזהות שלך.
            <br />
            הבקשה תעבור להמשך טיפול.
          </p>
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
