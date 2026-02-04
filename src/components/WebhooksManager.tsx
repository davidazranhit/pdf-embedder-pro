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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Webhook, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

interface WebhookData {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

interface WebhookLog {
  id: string;
  event: string;
  payload: any;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  created_at: string;
}

const AVAILABLE_EVENTS = [
  { id: "request.created", label: "בקשה חדשה נוצרה" },
  { id: "request.sent", label: "קבצים נשלחו" },
  { id: "request.status_changed", label: "סטטוס בקשה השתנה" },
  { id: "template.uploaded", label: "תבנית הועלתה" },
  { id: "template.deleted", label: "תבנית נמחקה" },
  { id: "trusted.added", label: "משתמש מהימן נוסף" },
  { id: "suspicious.marked", label: "משתמש סומן כחשוד" },
];

export function WebhooksManager() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteWebhook, setDeleteWebhook] = useState<WebhookData | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Form state
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error("Error loading webhooks:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את ה-Webhooks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadWebhookLogs = async (webhookId: string) => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("*")
        .eq("webhook_id", webhookId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setWebhookLogs(data || []);
    } catch (error) {
      console.error("Error loading webhook logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const createWebhook = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין שם וכתובת URL",
        variant: "destructive",
      });
      return;
    }

    if (newEvents.length === 0) {
      toast({
        title: "שגיאה",
        description: "יש לבחור לפחות אירוע אחד",
        variant: "destructive",
      });
      return;
    }

    // Validate URL
    try {
      new URL(newUrl);
    } catch {
      toast({
        title: "שגיאה",
        description: "כתובת URL לא תקינה",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("webhooks").insert({
        name: newName,
        url: newUrl,
        events: newEvents,
        secret: newSecret || null,
        created_by: userData.user?.id,
      });

      if (error) throw error;

      loadWebhooks();
      resetDialog();
      
      toast({
        title: "Webhook נוצר בהצלחה",
        description: "ה-Webhook יופעל בעת התרחשות האירועים שנבחרו",
      });
    } catch (error) {
      console.error("Error creating webhook:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן ליצור Webhook",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const deleteWebhookHandler = async () => {
    if (!deleteWebhook) return;

    try {
      const { error } = await supabase
        .from("webhooks")
        .delete()
        .eq("id", deleteWebhook.id);

      if (error) throw error;

      loadWebhooks();
      toast({
        title: "Webhook נמחק",
        description: "ה-Webhook הוסר בהצלחה",
      });
    } catch (error) {
      console.error("Error deleting webhook:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את ה-Webhook",
        variant: "destructive",
      });
    } finally {
      setDeleteWebhook(null);
    }
  };

  const toggleWebhookStatus = async (webhook: WebhookData) => {
    try {
      const { error } = await supabase
        .from("webhooks")
        .update({ is_active: !webhook.is_active })
        .eq("id", webhook.id);

      if (error) throw error;
      loadWebhooks();
    } catch (error) {
      console.error("Error updating webhook:", error);
    }
  };

  const testWebhook = async (webhook: WebhookData) => {
    setIsTesting(webhook.id);
    try {
      const response = await supabase.functions.invoke("trigger-webhook", {
        body: {
          webhookId: webhook.id,
          event: "test",
          payload: {
            message: "זוהי בדיקה",
            timestamp: new Date().toISOString(),
          },
        },
      });

      if (response.error) throw response.error;

      toast({
        title: "בדיקה נשלחה",
        description: response.data.success ? "ה-Webhook הגיב בהצלחה" : "ה-Webhook נכשל",
        variant: response.data.success ? "default" : "destructive",
      });

      // Reload logs
      if (expandedLogs === webhook.id) {
        loadWebhookLogs(webhook.id);
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      toast({
        title: "שגיאה בבדיקה",
        description: "לא ניתן לבדוק את ה-Webhook",
        variant: "destructive",
      });
    } finally {
      setIsTesting(null);
    }
  };

  const toggleLogs = (webhookId: string) => {
    if (expandedLogs === webhookId) {
      setExpandedLogs(null);
      setWebhookLogs([]);
    } else {
      setExpandedLogs(webhookId);
      loadWebhookLogs(webhookId);
    }
  };

  const resetDialog = () => {
    setNewName("");
    setNewUrl("");
    setNewEvents([]);
    setNewSecret("");
    setIsDialogOpen(false);
  };

  const toggleEvent = (eventId: string) => {
    setNewEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
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
          <Webhook className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-semibold">Webhooks</h3>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetDialog();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              הוסף Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>הוספת Webhook חדש</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhookName">שם</Label>
                <Input
                  id="webhookName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="לדוגמה: התראות Slack"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookUrl">כתובת URL</Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label>אירועים להאזנה</Label>
                <div className="space-y-2 p-3 border rounded-lg max-h-48 overflow-y-auto">
                  {AVAILABLE_EVENTS.map((event) => (
                    <div key={event.id} className="flex items-center gap-2">
                      <Checkbox
                        id={event.id}
                        checked={newEvents.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                      />
                      <label htmlFor={event.id} className="text-sm cursor-pointer">
                        {event.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookSecret">Secret (אופציונלי)</Label>
                <Input
                  id="webhookSecret"
                  type="password"
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                  placeholder="מפתח סודי לחתימת הבקשות"
                />
                <p className="text-xs text-muted-foreground">
                  אם תגדיר secret, נוסיף חתימת HMAC-SHA256 ל-header בשם X-Webhook-Signature
                </p>
              </div>

              <Button 
                onClick={createWebhook} 
                className="w-full"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    יוצר...
                  </>
                ) : (
                  "צור Webhook"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {webhooks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>אין Webhooks עדיין</p>
          <p className="text-sm">הוסף Webhook כדי לקבל התראות על אירועים במערכת</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Collapsible key={webhook.id}>
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.name}</span>
                      <Badge variant={webhook.is_active ? "default" : "secondary"}>
                        {webhook.is_active ? "פעיל" : "מושבת"}
                      </Badge>
                      {webhook.failure_count > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {webhook.failure_count} כשלונות
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono truncate max-w-md">
                      {webhook.url}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {AVAILABLE_EVENTS.find(e => e.id === event)?.label || event}
                        </Badge>
                      ))}
                    </div>
                    {webhook.last_triggered_at && (
                      <div className="text-xs text-muted-foreground">
                        הופעל לאחרונה: {format(new Date(webhook.last_triggered_at), "dd/MM/yyyy HH:mm")}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testWebhook(webhook)}
                      disabled={isTesting === webhook.id}
                    >
                      {isTesting === webhook.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        "בדוק"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleWebhookStatus(webhook)}
                    >
                      {webhook.is_active ? "השבת" : "הפעל"}
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLogs(webhook.id)}
                      >
                        {expandedLogs === webhook.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteWebhook(webhook)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <CollapsibleContent>
                  {expandedLogs === webhook.id && (
                    <div className="border-t p-4 bg-muted/20">
                      <h4 className="font-medium mb-3">לוג קריאות אחרונות</h4>
                      {loadingLogs ? (
                        <div className="flex justify-center py-4">
                          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : webhookLogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          אין לוגים עדיין
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {webhookLogs.map((log) => (
                            <div
                              key={log.id}
                              className="flex items-start gap-3 p-2 border rounded text-sm"
                            >
                              {log.success ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5" />
                              ) : (
                                <XCircle className="w-4 h-4 text-destructive mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {log.event}
                                  </Badge>
                                  {log.response_status && (
                                    <span className={`text-xs ${log.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                      HTTP {log.response_status}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(log.created_at), "dd/MM HH:mm:ss")}
                                  </span>
                                </div>
                                {log.response_body && !log.success && (
                                  <div className="mt-1 text-xs text-destructive truncate">
                                    {log.response_body}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteWebhook} onOpenChange={() => setDeleteWebhook(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את ה-Webhook "{deleteWebhook?.name}"?
              <br />
              פעולה זו לא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={deleteWebhookHandler} className="bg-destructive text-destructive-foreground">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
