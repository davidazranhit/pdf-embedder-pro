import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogoutButton } from "@/components/LogoutButton";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, 
  Users, 
  UserPlus, 
  Shield, 
  Edit2, 
  Trash2, 
  RefreshCw,
  Crown,
  Eye,
  Pencil
} from "lucide-react";
import { format } from "date-fns";

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  role: "admin" | "editor" | "viewer" | "user";
  created_at: string;
}

const ROLE_CONFIG = {
  admin: {
    label: "מנהל",
    description: "גישה מלאה לכל המערכת",
    icon: Crown,
    color: "bg-amber-500 dark:bg-amber-600",
  },
  editor: {
    label: "עורך",
    description: "יכול לנהל בקשות, תבניות וקורסים",
    icon: Pencil,
    color: "bg-blue-500 dark:bg-blue-600",
  },
  viewer: {
    label: "צופה",
    description: "יכול לצפות בלבד",
    icon: Eye,
    color: "bg-slate-500 dark:bg-slate-600",
  },
  user: {
    label: "משתמש",
    description: "גישה בסיסית",
    icon: Users,
    color: "bg-muted",
  },
};

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserWithRole | null>(null);
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  
  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // Get all user roles with user info
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each role, we need to get the user email from auth.users
      // Since we can't query auth.users directly, we'll use the admin API through an edge function
      // For now, we'll show the user_id and role
      const usersWithRoles: UserWithRole[] = (roles || []).map((role) => ({
        id: role.id,
        user_id: role.user_id,
        email: role.user_id, // Will be replaced with actual email if we have it
        role: role.role as "admin" | "editor" | "viewer" | "user",
        created_at: role.created_at || new Date().toISOString(),
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את רשימת המשתמשים",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createUser = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין אימייל וסיסמה",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "שגיאה",
        description: "הסיסמה חייבת להכיל לפחות 6 תווים",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create user through edge function that has admin privileges
      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: newEmail,
          password: newPassword,
          role: newRole,
        },
      });

      if (response.error) throw response.error;

      toast({
        title: "משתמש נוצר בהצלחה",
        description: `המשתמש ${newEmail} נוצר עם תפקיד ${ROLE_CONFIG[newRole].label}`,
      });

      resetDialog();
      loadUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן ליצור משתמש",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const updateUserRole = async () => {
    if (!editUser) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: editUser.role })
        .eq("id", editUser.id);

      if (error) throw error;

      toast({
        title: "התפקיד עודכן",
        description: `התפקיד עודכן ל-${ROLE_CONFIG[editUser.role].label}`,
      });

      setEditUser(null);
      loadUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את התפקיד",
        variant: "destructive",
      });
    }
  };

  const deleteUserHandler = async () => {
    if (!deleteUser) return;

    try {
      // Delete the role (user remains in auth but loses access)
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", deleteUser.id);

      if (error) throw error;

      toast({
        title: "המשתמש הוסר",
        description: "הרשאות המשתמש הוסרו בהצלחה",
      });

      setDeleteUser(null);
      loadUsers();
    } catch (error) {
      console.error("Error deleting user role:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן להסיר את המשתמש",
        variant: "destructive",
      });
    }
  };

  const resetDialog = () => {
    setNewEmail("");
    setNewPassword("");
    setNewRole("viewer");
    setIsDialogOpen(false);
  };

  const getRoleBadge = (role: string) => {
    const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.user;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Link to="/sys-admin">
                <Button variant="outline" className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  חזרה למערכת
                </Button>
              </Link>
              <LogoutButton />
            </div>
            <div className="text-center">
              <div className="inline-block p-3 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
                <Shield className="w-12 h-12 text-primary-foreground" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                ניהול משתמשים
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                הוספה וניהול הרשאות משתמשים במערכת
              </p>
            </div>
          </div>

          {/* Role Legend */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["admin", "editor", "viewer"] as const).map((role) => {
              const config = ROLE_CONFIG[role];
              const Icon = config.icon;
              return (
                <Card key={role} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{config.label}</p>
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Users Table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold">משתמשי המערכת</h2>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  if (!open) resetDialog();
                  setIsDialogOpen(open);
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <UserPlus className="w-4 h-4" />
                      הוסף משתמש
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>הוספת משתמש חדש</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">אימייל</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="user@example.com"
                          dir="ltr"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">סיסמה</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="לפחות 6 תווים"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>תפקיד</Label>
                        <Select value={newRole} onValueChange={(v) => setNewRole(v as typeof newRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Crown className="w-4 h-4" />
                                מנהל - גישה מלאה
                              </div>
                            </SelectItem>
                            <SelectItem value="editor">
                              <div className="flex items-center gap-2">
                                <Pencil className="w-4 h-4" />
                                עורך - ניהול תוכן
                              </div>
                            </SelectItem>
                            <SelectItem value="viewer">
                              <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                צופה - צפייה בלבד
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button 
                        onClick={createUser} 
                        className="w-full"
                        disabled={isCreating}
                      >
                        {isCreating ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            יוצר משתמש...
                          </>
                        ) : (
                          "צור משתמש"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>אין משתמשים במערכת</p>
                <p className="text-sm">הוסף משתמש ראשון כדי להתחיל</p>
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">משתמש</TableHead>
                      <TableHead className="text-right">תפקיד</TableHead>
                      <TableHead className="text-right">תאריך הוספה</TableHead>
                      <TableHead className="text-right w-24">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium font-mono text-sm">
                          {user.email.includes("@") ? user.email : `ID: ${user.user_id.substring(0, 8)}...`}
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(user.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditUser(user)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteUser(user)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת תפקיד</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>תפקיד חדש</Label>
                <Select 
                  value={editUser.role} 
                  onValueChange={(v) => setEditUser({ ...editUser, role: v as typeof editUser.role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">מנהל</SelectItem>
                    <SelectItem value="editor">עורך</SelectItem>
                    <SelectItem value="viewer">צופה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={updateUserRole} className="w-full">
                שמור שינויים
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>הסרת משתמש</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך להסיר את הרשאות המשתמש?
              <br />
              המשתמש יאבד את הגישה למערכת.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUserHandler} className="bg-destructive text-destructive-foreground">
              הסר משתמש
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
