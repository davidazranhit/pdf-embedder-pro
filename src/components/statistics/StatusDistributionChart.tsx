import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { CheckSquare } from "lucide-react";

interface RequestData {
  status: "pending" | "sent" | "handled_not_sent";
}

interface StatusDistributionChartProps {
  requests: RequestData[];
}

const COLORS = {
  sent: "hsl(142.1 76.2% 36.3%)",
  pending: "hsl(38 92% 50%)",
  handled_not_sent: "hsl(var(--muted-foreground))",
};

export const StatusDistributionChart = ({ requests }: StatusDistributionChartProps) => {
  const chartData = useMemo(() => {
    const sent = requests.filter(r => r.status === "sent").length;
    const pending = requests.filter(r => r.status === "pending").length;
    const handledNotSent = requests.filter(r => r.status === "handled_not_sent").length;
    
    return [
      { name: "נשלחו", value: sent, fill: COLORS.sent },
      { name: "ממתינים", value: pending, fill: COLORS.pending },
      { name: "טופל - לא נשלח", value: handledNotSent, fill: COLORS.handled_not_sent },
    ].filter(item => item.value > 0);
  }, [requests]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <CheckSquare className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">התפלגות סטטוס</h2>
      </div>
      <div className="h-[250px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                direction: "rtl"
              }}
              formatter={(value) => [`${value} בקשות`, ""]}
            />
            <Legend 
              wrapperStyle={{ direction: "rtl" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
