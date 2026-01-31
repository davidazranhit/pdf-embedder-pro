import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { LogoutButton } from "@/components/LogoutButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ArrowRight, Search, Users, Mail, FileText } from "lucide-react";
import { RequestsTrendChart } from "@/components/statistics/RequestsTrendChart";
import { CourseDistributionChart } from "@/components/statistics/CourseDistributionChart";
import { ProcessingTimeStats } from "@/components/statistics/ProcessingTimeStats";
import { StatusDistributionChart } from "@/components/statistics/StatusDistributionChart";

interface RequestData {
  id: string;
  email: string;
  id_number: string;
  course_name: string;
  submission_date: string;
  sent_date: string | null;
  status: "pending" | "sent";
}

interface UserStats {
  email: string;
  id_number: string;
  courses: string[];
  totalRequests: number;
  lastRequest: string;
}

const Statistics = () => {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("file_requests")
      .select("id, email, id_number, course_name, submission_date, sent_date, status")
      .order("submission_date", { ascending: false });

    if (error) {
      console.error("Error fetching requests:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את הנתונים",
        variant: "destructive",
      });
    } else {
      setRequests(data || []);
    }
    setIsLoading(false);
  };

  // Aggregate users data
  const userStats = useMemo(() => {
    const userMap = new Map<string, UserStats>();

    requests.forEach((req) => {
      const key = `${req.email}-${req.id_number}`;
      
      if (userMap.has(key)) {
        const existing = userMap.get(key)!;
        if (!existing.courses.includes(req.course_name)) {
          existing.courses.push(req.course_name);
        }
        existing.totalRequests++;
        if (new Date(req.submission_date) > new Date(existing.lastRequest)) {
          existing.lastRequest = req.submission_date;
        }
      } else {
        userMap.set(key, {
          email: req.email,
          id_number: req.id_number,
          courses: [req.course_name],
          totalRequests: 1,
          lastRequest: req.submission_date,
        });
      }
    });

    return Array.from(userMap.values()).sort((a, b) => 
      new Date(b.lastRequest).getTime() - new Date(a.lastRequest).getTime()
    );
  }, [requests]);

  // Filter by search
  const filteredStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return userStats;
    
    return userStats.filter((user) =>
      user.email.toLowerCase().includes(q) ||
      user.id_number.toLowerCase().includes(q) ||
      user.courses.some((c) => c.toLowerCase().includes(q))
    );
  }, [userStats, search]);

  // Course statistics
  const courseStats = useMemo(() => {
    const courseMap = new Map<string, number>();
    requests.forEach((req) => {
      courseMap.set(req.course_name, (courseMap.get(req.course_name) || 0) + 1);
    });
    return Array.from(courseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [requests]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("he-IL", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Link to="/sys-admin">
                <Button variant="outline" className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  חזרה לדף הראשי
                </Button>
              </Link>
              <LogoutButton />
            </div>
            <div className="text-center">
              <div className="inline-block p-3 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
                <BarChart3 className="w-12 h-12 text-primary-foreground" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                נתונים סטטיסטיים
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                צפייה בכל המשתמשים שהגישו בקשות והקורסים שביקשו
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{userStats.length}</p>
                  <p className="text-sm text-muted-foreground">משתמשים ייחודיים</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{requests.length}</p>
                  <p className="text-sm text-muted-foreground">סה״כ בקשות</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{courseStats.length}</p>
                  <p className="text-sm text-muted-foreground">קורסים שונים</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Processing Time Stats */}
          <ProcessingTimeStats requests={requests} />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RequestsTrendChart requests={requests} />
            <StatusDistributionChart requests={requests} />
          </div>

          {/* Course Distribution Chart */}
          <CourseDistributionChart courseStats={courseStats} />

          {/* Users Table */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">רשימת משתמשים</h2>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="חיפוש לפי מייל, ת.ז או קורס..."
                    className="max-w-[300px]"
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                מציג {filteredStats.length} מתוך {userStats.length} משתמשים
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">טוען...</div>
              ) : filteredStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>לא נמצאו משתמשים</p>
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">מייל</TableHead>
                        <TableHead className="text-right">תעודת זהות</TableHead>
                        <TableHead className="text-right">קורסים מבוקשים</TableHead>
                        <TableHead className="text-right">מספר בקשות</TableHead>
                        <TableHead className="text-right">בקשה אחרונה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStats.map((user, index) => (
                        <TableRow key={`${user.email}-${user.id_number}-${index}`}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.id_number}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.courses.map((course) => (
                                <Badge key={course} variant="outline" className="text-xs">
                                  {course}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.totalRequests > 1 ? "default" : "secondary"}>
                              {user.totalRequests}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(user.lastRequest)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
