import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-muted rounded-full mb-4">
          <FileQuestion className="w-10 h-10 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">404</h1>
          <p className="text-xl text-muted-foreground">הדף לא נמצא</p>
          <p className="text-sm text-muted-foreground">
            הדף שחיפשת אינו קיים או שהוסר
          </p>
        </div>

        <Button
          onClick={() => window.location.href = "/request-access"}
          size="lg"
          className="w-full"
        >
          חזרה לבקשת קבצים
        </Button>
      </Card>
    </div>
  );
};

export default NotFound;
