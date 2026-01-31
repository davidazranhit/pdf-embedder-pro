import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Clock, CheckCircle2, AlertCircle, Timer } from "lucide-react";

interface RequestData {
  submission_date: string;
  sent_date: string | null;
  status: "pending" | "sent";
}

interface ProcessingTimeStatsProps {
  requests: RequestData[];
}

export const ProcessingTimeStats = ({ requests }: ProcessingTimeStatsProps) => {
  const stats = useMemo(() => {
    const sentRequests = requests.filter(r => r.status === "sent" && r.sent_date);
    const pendingRequests = requests.filter(r => r.status === "pending");
    
    // Calculate average processing time for sent requests
    let totalProcessingHours = 0;
    let validProcessingCount = 0;
    
    sentRequests.forEach(req => {
      if (req.sent_date) {
        const submissionDate = new Date(req.submission_date);
        const sentDate = new Date(req.sent_date);
        const diffHours = (sentDate.getTime() - submissionDate.getTime()) / (1000 * 60 * 60);
        if (diffHours >= 0 && diffHours < 720) { // Ignore if more than 30 days
          totalProcessingHours += diffHours;
          validProcessingCount++;
        }
      }
    });
    
    const avgProcessingHours = validProcessingCount > 0 
      ? totalProcessingHours / validProcessingCount 
      : 0;
    
    // Calculate pending time for pending requests
    const now = new Date();
    let oldestPendingHours = 0;
    
    pendingRequests.forEach(req => {
      const submissionDate = new Date(req.submission_date);
      const pendingHours = (now.getTime() - submissionDate.getTime()) / (1000 * 60 * 60);
      if (pendingHours > oldestPendingHours) {
        oldestPendingHours = pendingHours;
      }
    });
    
    // Success rate
    const successRate = requests.length > 0 
      ? (sentRequests.length / requests.length) * 100 
      : 0;
    
    return {
      avgProcessingHours,
      pendingCount: pendingRequests.length,
      sentCount: sentRequests.length,
      oldestPendingHours,
      successRate,
    };
  }, [requests]);

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} דקות`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)} שעות`;
    } else {
      return `${(hours / 24).toFixed(1)} ימים`;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-lg font-bold">
              {stats.avgProcessingHours > 0 ? formatHours(stats.avgProcessingHours) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">זמן טיפול ממוצע</p>
          </div>
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{stats.successRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">אחוז שליחה</p>
          </div>
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{stats.pendingCount}</p>
            <p className="text-xs text-muted-foreground">ממתינים לטיפול</p>
          </div>
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10">
            <Clock className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-bold">
              {stats.oldestPendingHours > 0 ? formatHours(stats.oldestPendingHours) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">הבקשה הוותיקה ביותר</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
