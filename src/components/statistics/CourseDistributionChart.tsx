import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface CourseStats {
  name: string;
  count: number;
}

interface CourseDistributionChartProps {
  courseStats: CourseStats[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(142.1 76.2% 36.3%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(200 80% 50%)",
  "hsl(340 75% 55%)",
  "hsl(160 60% 45%)",
  "hsl(25 95% 53%)",
];

export const CourseDistributionChart = ({ courseStats }: CourseDistributionChartProps) => {
  const chartData = useMemo(() => {
    return courseStats.slice(0, 8).map((course, index) => ({
      ...course,
      fill: COLORS[index % COLORS.length],
    }));
  }, [courseStats]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <PieChartIcon className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">התפלגות לפי קורסים</h2>
      </div>
      <div className="h-[300px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              type="number"
              tick={{ fontSize: 12 }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis 
              type="category"
              dataKey="name" 
              tick={{ fontSize: 11 }}
              tickLine={false}
              width={120}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                direction: "rtl"
              }}
              formatter={(value) => [`${value} בקשות`, "כמות"]}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
