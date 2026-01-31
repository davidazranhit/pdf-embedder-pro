import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface RequestData {
  submission_date: string;
  status: "pending" | "sent";
}

interface RequestsTrendChartProps {
  requests: RequestData[];
}

export const RequestsTrendChart = ({ requests }: RequestsTrendChartProps) => {
  const chartData = useMemo(() => {
    const dateMap = new Map<string, { total: number; sent: number; pending: number }>();
    
    // Group by date
    requests.forEach((req) => {
      const date = new Date(req.submission_date).toLocaleDateString("he-IL", {
        day: "2-digit",
        month: "2-digit",
      });
      
      const existing = dateMap.get(date) || { total: 0, sent: 0, pending: 0 };
      existing.total++;
      if (req.status === "sent") {
        existing.sent++;
      } else {
        existing.pending++;
      }
      dateMap.set(date, existing);
    });

    // Sort by date and take last 30 days
    return Array.from(dateMap.entries())
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .slice(-30);
  }, [requests]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">מגמת בקשות לאורך זמן</h2>
      </div>
      <div className="h-[300px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                direction: "rtl"
              }}
              labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
            />
            <Legend 
              wrapperStyle={{ direction: "rtl" }}
              formatter={(value) => {
                if (value === "total") return "סה״כ";
                if (value === "sent") return "נשלחו";
                if (value === "pending") return "ממתינים";
                return value;
              }}
            />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey="sent" 
              stroke="hsl(142.1 76.2% 36.3%)" 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="pending" 
              stroke="hsl(38 92% 50%)" 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
