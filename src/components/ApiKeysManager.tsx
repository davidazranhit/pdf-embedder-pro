import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, Trash2, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: "read_requests", label: "קריאת בקשות" },
  { id: "write_requests", label: "עדכון בקשות" },
  { id: "read_templates", label: "קריאת תבניות" },
  { id: "write_templates", label: "ניהול תבניות" },
  { id: "trigger_webhooks", label: "הפעלת webhooks" },
];

export function ApiKeysManager() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteKey, setDeleteKey] = useState<ApiKey | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([]);
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, permissions, is_active, last_used_at, expires_at, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error("Error loading API keys:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את מפתחות ה-API",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'pk_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const hashKey = async (key: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין שם למפתח",
        variant: "destructive",
      });
      return;
    }

    if (newKeyPermissions.length === 0) {
      toast({
        title: "שגיאה",
        description: "יש לבחור לפחות הרשאה אחת",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const rawKey = generateApiKey();
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.substring(0, 7);

      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("api_keys").insert({
        name: newKeyName,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions: newKeyPermissions,
        created_by: userData.user?.id,
        expires_at: newKeyExpiry || null,
      });

      if (error) throw error;

      setGeneratedKey(rawKey);
      loadApiKeys();
      
      toast({
        title: "מפתח נוצר בהצלחה",
        description: "שמור את המפתח במקום בטוח - לא תוכל לראות אותו שוב!",
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן ליצור מפתח API",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const deleteApiKey = async () => {
    if (!deleteKey) return;

    try {
      const { error } = await supabase
        .from("api_keys")
        .delete()
        .eq("id", deleteKey.id);

      if (error) throw error;

      loadApiKeys();
      toast({
        title: "מפתח נמחק",
        description: "המפתח הוסר בהצלחה",
      });
    } catch (error) {
      console.error("Error deleting API key:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את המפתח",
        variant: "destructive",
      });
    } finally {
      setDeleteKey(null);
    }
  };

  const toggleKeyStatus = async (key: ApiKey) => {
    try {
      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: !key.is_active })
        .eq("id", key.id);

      if (error) throw error;
      loadApiKeys();
    } catch (error) {
      console.error("Error updating API key:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "הועתק!",
      description: "המפתח הועתק ללוח",
    });
  };

  const resetDialog = () => {
    setNewKeyName("");
    setNewKeyPermissions([]);
    setNewKeyExpiry("");
    setGeneratedKey(null);
    setShowKey(false);
    setIsDialogOpen(false);
  };

  const togglePermission = (permId: string) => {
    setNewKeyPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Key className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-semibold">מפתחות API</h3>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetDialog();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              צור מפתח חדש
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {generatedKey ? "המפתח נוצר בהצלחה!" : "יצירת מפתח API חדש"}
              </DialogTitle>
            </DialogHeader>
            
            {generatedKey ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-2">⚠️ שמור את המפתח עכשיו!</p>
                  <p className="text-sm">לא תוכל לראות את המפתח המלא שוב לאחר סגירת החלון הזה.</p>
                </div>
                
                <div className="space-y-2">
                  <Label>מפתח ה-API שלך:</Label>
                  <div className="flex gap-2">
                    <Input 
                      type={showKey ? "text" : "password"} 
                      value={generatedKey} 
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(generatedKey)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button onClick={resetDialog} className="w-full">
                  סגור
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">שם המפתח</Label>
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="לדוגמה: אינטגרציה עם CRM"
                  />
                </div>

                <div className="space-y-2">
                  <Label>הרשאות</Label>
                  <div className="space-y-2 p-3 border rounded-lg">
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-2">
                        <Checkbox
                          id={perm.id}
                          checked={newKeyPermissions.includes(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <label htmlFor={perm.id} className="text-sm cursor-pointer">
                          {perm.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keyExpiry">תאריך תפוגה (אופציונלי)</Label>
                  <Input
                    id="keyExpiry"
                    type="date"
                    value={newKeyExpiry}
                    onChange={(e) => setNewKeyExpiry(e.target.value)}
                  />
                </div>

                <Button 
                  onClick={createApiKey} 
                  className="w-full"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      יוצר מפתח...
                    </>
                  ) : (
                    "צור מפתח"
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>אין מפתחות API עדיין</p>
          <p className="text-sm">צור מפתח ראשון כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{key.name}</span>
                  <Badge variant={key.is_active ? "default" : "secondary"}>
                    {key.is_active ? "פעיל" : "מושבת"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground font-mono">
                  {key.key_prefix}...
                </div>
                <div className="flex gap-2 flex-wrap">
                  {key.permissions.map((perm) => (
                    <Badge key={perm} variant="outline" className="text-xs">
                      {AVAILABLE_PERMISSIONS.find(p => p.id === perm)?.label || perm}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  נוצר: {format(new Date(key.created_at), "dd/MM/yyyy")}
                  {key.last_used_at && ` | שימוש אחרון: ${format(new Date(key.last_used_at), "dd/MM/yyyy HH:mm")}`}
                  {key.expires_at && ` | תפוגה: ${format(new Date(key.expires_at), "dd/MM/yyyy")}`}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleKeyStatus(key)}
                >
                  {key.is_active ? "השבת" : "הפעל"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteKey(key)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteKey} onOpenChange={() => setDeleteKey(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת מפתח API</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את המפתח "{deleteKey?.name}"?
              <br />
              פעולה זו לא ניתנת לביטול וכל האינטגרציות המשתמשות במפתח זה יפסיקו לעבוד.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={deleteApiKey} className="bg-destructive text-destructive-foreground">
              מחק מפתח
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
