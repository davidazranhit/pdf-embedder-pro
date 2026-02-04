import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogoutButton } from "@/components/LogoutButton";
import { ArrowRight, Settings as SettingsIcon, BookOpen, Bell, Key, Webhook, User } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CourseManager } from "@/components/CourseManager";
import { ApiKeysManager } from "@/components/ApiKeysManager";
import { WebhooksManager } from "@/components/WebhooksManager";
import { useUserRole } from "@/hooks/useUserRole";
import { useEditorSettings } from "@/hooks/useEditorSettings";

interface WatermarkPosition {
  type: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center";
  enabled: boolean;
}

const Settings = () => {
  const { toast } = useToast();
  const { isAdmin, isEditor, isLoading: isRoleLoading } = useUserRole();
  const { settings: editorSettings, updateSettings: updateEditorSettings } = useEditorSettings();
  const [watermarkPositions, setWatermarkPositions] = useState<WatermarkPosition[]>([
    { type: "top-right", enabled: true },
    { type: "top-left", enabled: false },
    { type: "bottom-right", enabled: true },
    { type: "bottom-left", enabled: true },
    { type: "center", enabled: true },
  ]);
  
  const [fontSize, setFontSize] = useState<number>(10);
  const [opacity, setOpacity] = useState<number>(0.4);
  const [centerRotation, setCenterRotation] = useState<number>(45);
  const [hiddenEnabled, setHiddenEnabled] = useState<boolean>(true);
  const [hiddenFontSize, setHiddenFontSize] = useState<number>(24);
  const [hiddenOpacity, setHiddenOpacity] = useState<number>(0.12);
  const [hiddenRowSpacing, setHiddenRowSpacing] = useState<number>(15);
  const [hiddenColSpacing, setHiddenColSpacing] = useState<number>(10);
  const [showHiddenPreview, setShowHiddenPreview] = useState<boolean>(false);
  const [emailSubject, setEmailSubject] = useState<string>("הקבצים המבוקשים שלך");
  const [emailBody, setEmailBody] = useState<string>("שלום,\n\nמצורפים הקבצים שלך לקורס.\n\nהקבצים מותאמים אישית עבורך – עם הפרטים שלך – והם נועדו לשימוש אישי בלבד.\n\nחשוב לדעת: כל שיתוף או העתקה של הקבצים נחשבים להפרה חמורה של זכויות יוצרים, ויגררו השלכות בהתאם.");
  const [formTitle, setFormTitle] = useState<string>("בקשת קבצים");
  const [formInstructions, setFormInstructions] = useState<string>("הוראות למילוי:\n\nעליך להזין מייל ותעודת זהות וקורס מבוקש.\n\nלאחר שליחת הבקשה הפרטים יועברו לבדיקה ולאחר אישור (אין טעם לעדכן ששלחתם את הבקשה, היא תטופל בהקדם) יישלחו הקבצים המבוקשים ישירות למייל עם הפרטים האישיים מוטמעים על הקבצים למניעת שיתוף והפצה.");
  const [formWarning, setFormWarning] = useState<string>("כל ניסיון שיתוף או הפצת הקבצים מהווה הפרה חמורה של זכויות יוצרים ויטופל בהתאם");
  const [coverEmailLabel, setCoverEmailLabel] = useState<string>("אימייל");
  const [coverIdLabel, setCoverIdLabel] = useState<string>("תעודת זהות");
  const [coverSuccessText, setCoverSuccessText] = useState<string>("בהצלחה!");
  const [adminEmail, setAdminEmail] = useState<string>("davidazran014@gmail.com");
  const [pendingAlertThreshold, setPendingAlertThreshold] = useState<number>(5);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load settings from database
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("watermark_settings")
        .select("*")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .single();

      if (error) throw error;

      if (data) {
        setWatermarkPositions(data.positions as unknown as WatermarkPosition[]);
        setFontSize(data.font_size);
        setOpacity(Number(data.opacity));
        setCenterRotation(data.center_rotation);
        setHiddenEnabled(data.hidden_watermark_enabled ?? true);
        setHiddenFontSize(data.hidden_watermark_font_size ?? 24);
        setHiddenOpacity(Number(data.hidden_watermark_opacity ?? 0.12));
        setHiddenRowSpacing(data.hidden_watermark_row_spacing ?? 15);
        setHiddenColSpacing(data.hidden_watermark_col_spacing ?? 10);
        setEmailSubject(data.email_subject ?? "הקבצים המבוקשים שלך");
        setEmailBody(data.email_body ?? "שלום,\n\nמצורפים הקבצים שלך לקורס.\n\nהקבצים מותאמים אישית עבורך – עם הפרטים שלך – והם נועדו לשימוש אישי בלבד.\n\nחשוב לדעת: כל שיתוף או העתקה של הקבצים נחשבים להפרה חמורה של זכויות יוצרים, ויגררו השלכות בהתאם.");
        setFormTitle(data.form_title ?? "בקשת קבצים");
        setFormInstructions(data.form_instructions ?? "הוראות למילוי:\n\nעליך להזין מייל ותעודת זהות וקורס מבוקש.\n\nלאחר שליחת הבקשה הפרטים יועברו לבדיקה ולאחר אישור (אין טעם לעדכן ששלחתם את הבקשה, היא תטופל בהקדם) יישלחו הקבצים המבוקשים ישירות למייל עם הפרטים האישיים מוטמעים על הקבצים למניעת שיתוף והפצה.");
        setFormWarning(data.form_warning ?? "כל ניסיון שיתוף או הפצת הקבצים מהווה הפרה חמורה של זכויות יוצרים ויטופל בהתאם");
        setCoverEmailLabel(data.cover_email_label ?? "אימייל");
        setCoverIdLabel(data.cover_id_label ?? "תעודת זהות");
        setCoverSuccessText(data.cover_success_text ?? "בהצלחה!");
        setAdminEmail(data.admin_email ?? "davidazran014@gmail.com");
        setPendingAlertThreshold(data.pending_alert_threshold ?? 5);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את ההגדרות",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const positionLabels: Record<string, string> = {
    "top-right": "למעלה מימין",
    "top-left": "למעלה משמאל",
    "bottom-right": "למטה מימין",
    "bottom-left": "למטה משמאל",
    "center": "מרכז",
  };

  const togglePosition = (type: string) => {
    setWatermarkPositions((prev) =>
      prev.map((pos) =>
        pos.type === type ? { ...pos, enabled: !pos.enabled } : pos
      )
    );
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("watermark_settings")
        .update({
          positions: watermarkPositions as any,
          font_size: fontSize,
          opacity: opacity,
          center_rotation: centerRotation,
          hidden_watermark_enabled: hiddenEnabled,
          hidden_watermark_font_size: hiddenFontSize,
          hidden_watermark_opacity: hiddenOpacity,
          hidden_watermark_row_spacing: hiddenRowSpacing,
          hidden_watermark_col_spacing: hiddenColSpacing,
          email_subject: emailSubject,
          email_body: emailBody,
          form_title: formTitle,
          form_instructions: formInstructions,
          form_warning: formWarning,
          cover_email_label: coverEmailLabel,
          cover_id_label: coverIdLabel,
          cover_success_text: coverSuccessText,
          admin_email: adminEmail,
          pending_alert_threshold: pendingAlertThreshold,
        })
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (error) throw error;

      toast({
        title: "הצלחה!",
        description: "ההגדרות נשמרו בהצלחה",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור את ההגדרות",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Preview watermark style
  const getWatermarkStyle = (position: string) => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      fontSize: `${fontSize}px`,
      opacity: opacity,
      color: "#888",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    };

    switch (position) {
      case "top-right":
        return { ...baseStyle, top: "20px", right: "15px" };
      case "top-left":
        return { ...baseStyle, top: "20px", left: "15px" };
      case "bottom-right":
        return { ...baseStyle, bottom: "15px", right: "15px" };
      case "bottom-left":
        return { ...baseStyle, bottom: "15px", left: "15px" };
      case "center":
        return {
          ...baseStyle,
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(${centerRotation}deg)`,
          fontSize: `${fontSize * 2}px`,
        };
      default:
        return baseStyle;
    }
  };

  // Wait for role to load before rendering
  if (isRoleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">טוען הגדרות...</p>
        </div>
      </div>
    );
  }

  // Determine the default tab based on role
  const defaultTab = isAdmin ? "watermark" : "courses";

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
                  חזרה למערכת
                </Button>
              </Link>
              <LogoutButton />
            </div>
            <div className="text-center">
              <div className="inline-block p-3 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
                <SettingsIcon className="w-12 h-12 text-primary-foreground" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {isAdmin ? "הגדרות מערכת" : "הגדרות"}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {isAdmin ? "ניהול הגדרות Watermarks, API ו-Webhooks" : "ניהול קורסים והגדרות אישיות"}
              </p>
            </div>
          </div>

          <Tabs defaultValue={defaultTab} className="space-y-6" dir="rtl">
            <TabsList className={`grid w-full max-w-2xl mx-auto ${isAdmin ? 'grid-cols-5' : 'grid-cols-2'}`}>
              {isAdmin && (
                <TabsTrigger value="watermark" className="gap-2">
                  <SettingsIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Watermark</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="courses" className="gap-2">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">קורסים</span>
              </TabsTrigger>
              {isEditor && !isAdmin && (
                <TabsTrigger value="my-settings" className="gap-2">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">הגדרות אישיות</span>
                </TabsTrigger>
              )}
              {isAdmin && (
                <>
                  <TabsTrigger value="api" className="gap-2">
                    <Key className="w-4 h-4" />
                    <span className="hidden sm:inline">API</span>
                  </TabsTrigger>
                  <TabsTrigger value="webhooks" className="gap-2">
                    <Webhook className="w-4 h-4" />
                    <span className="hidden sm:inline">Webhooks</span>
                  </TabsTrigger>
                  <TabsTrigger value="alerts" className="gap-2">
                    <Bell className="w-4 h-4" />
                    <span className="hidden sm:inline">התראות</span>
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {isAdmin && (
              <TabsContent value="watermark">
                <div className="grid md:grid-cols-2 gap-8">
            {/* Settings Panel */}
            <Card className="p-8 shadow-lg border-border/50 space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-6 text-foreground">
                  הגדרות תצוגה
                </h2>

                {/* Position Toggles */}
                <div className="space-y-4 mb-8">
                  <Label className="text-lg font-medium">מיקומי Watermark</Label>
                  <div className="space-y-3">
                    {watermarkPositions.map((pos) => (
                      <div
                        key={pos.type}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-foreground">{positionLabels[pos.type]}</span>
                        <Button
                          variant={pos.enabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => togglePosition(pos.type)}
                        >
                          {pos.enabled ? "מופעל" : "כבוי"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="space-y-3 mb-6">
                  <Label className="text-base font-medium">
                    גודל גופן: {fontSize}
                  </Label>
                  <Slider
                    value={[fontSize]}
                    onValueChange={(val) => setFontSize(val[0])}
                    min={8}
                    max={16}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Opacity */}
                <div className="space-y-3 mb-6">
                  <Label className="text-base font-medium">
                    שקיפות: {Math.round(opacity * 100)}%
                  </Label>
                  <Slider
                    value={[opacity * 100]}
                    onValueChange={(val) => setOpacity(val[0] / 100)}
                    min={10}
                    max={80}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Center Rotation */}
                <div className="space-y-3 mb-6">
                  <Label className="text-base font-medium">
                    זווית מרכז: {centerRotation}°
                  </Label>
                  <Slider
                    value={[centerRotation]}
                    onValueChange={(val) => setCenterRotation(val[0])}
                    min={0}
                    max={90}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Hidden Watermarks Section */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-xl font-semibold mb-4 text-foreground">
                    Watermarks נסתרים
                  </h3>
                  
                  {/* Enable/Disable Hidden Watermarks */}
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors mb-4">
                    <span className="text-foreground">הפעל Watermarks נסתרים</span>
                    <Button
                      variant={hiddenEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setHiddenEnabled(!hiddenEnabled)}
                    >
                      {hiddenEnabled ? "מופעל" : "כבוי"}
                    </Button>
                  </div>

                  {hiddenEnabled && (
                    <>
                      {/* Hidden Font Size */}
                      <div className="space-y-3 mb-6">
                        <Label className="text-base font-medium">
                          גודל גופן נסתר: {hiddenFontSize}
                        </Label>
                        <Slider
                          value={[hiddenFontSize]}
                          onValueChange={(val) => setHiddenFontSize(val[0])}
                          min={16}
                          max={32}
                          step={2}
                          className="w-full"
                        />
                      </div>

                      {/* Hidden Opacity */}
                      <div className="space-y-3 mb-6">
                        <Label className="text-base font-medium">
                          שקיפות נסתרת: {Math.round(hiddenOpacity * 100)}%
                        </Label>
                        <Slider
                          value={[hiddenOpacity * 100]}
                          onValueChange={(val) => setHiddenOpacity(val[0] / 100)}
                          min={5}
                          max={20}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      {/* Hidden Row Spacing */}
                      <div className="space-y-3 mb-6">
                        <Label className="text-base font-medium">
                          מרווח שורות: {hiddenRowSpacing}
                        </Label>
                        <Slider
                          value={[hiddenRowSpacing]}
                          onValueChange={(val) => setHiddenRowSpacing(val[0])}
                          min={10}
                          max={30}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      {/* Hidden Column Spacing */}
                      <div className="space-y-3 mb-6">
                        <Label className="text-base font-medium">
                          מרווח עמודות: {hiddenColSpacing}
                        </Label>
                        <Slider
                          value={[hiddenColSpacing]}
                          onValueChange={(val) => setHiddenColSpacing(val[0])}
                          min={5}
                          max={20}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Email Template Section */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-xl font-semibold mb-4 text-foreground">
                    תבנית מייל
                  </h3>
                  
                  {/* Email Subject */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      כותרת המייל
                    </Label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full"
                      placeholder="הכנס כותרת למייל"
                    />
                  </div>

                  {/* Email Body */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      תוכן המייל (לפני רשימת הקבצים)
                    </Label>
                    <Textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full min-h-[200px]"
                      placeholder="הכנס את תוכן המייל"
                    />
                    <p className="text-sm text-muted-foreground">
                      רשימת הקבצים והמשפט "בהצלחה בקורס!" יתווספו אוטומטית אחרי הטקסט שתגדיר
                    </p>
                  </div>
                </div>

                {/* File Request Form Section */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-xl font-semibold mb-4 text-foreground">
                    טופס בקשת קבצים
                  </h3>
                  
                  {/* Form Title */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      כותרת הטופס
                    </Label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full"
                      placeholder="הכנס כותרת לטופס"
                    />
                  </div>

                  {/* Form Instructions */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      הוראות למילוי
                    </Label>
                    <Textarea
                      value={formInstructions}
                      onChange={(e) => setFormInstructions(e.target.value)}
                      className="w-full min-h-[150px]"
                      placeholder="הכנס את ההוראות למילוי הטופס"
                    />
                  </div>

                  {/* Form Warning */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      אזהרת זכויות יוצרים
                    </Label>
                    <Textarea
                      value={formWarning}
                      onChange={(e) => setFormWarning(e.target.value)}
                      className="w-full min-h-[100px]"
                      placeholder="הכנס את האזהרה על זכויות יוצרים"
                    />
                  </div>
                </div>

                {/* Cover Page Section */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-xl font-semibold mb-4 text-foreground">
                    דף כריכה
                  </h3>
                  
                  {/* Email Label */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      תווית אימייל
                    </Label>
                    <Input
                      value={coverEmailLabel}
                      onChange={(e) => setCoverEmailLabel(e.target.value)}
                      className="w-full"
                      placeholder='אימייל'
                    />
                  </div>

                  {/* ID Label */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      תווית תעודת זהות
                    </Label>
                    <Input
                      value={coverIdLabel}
                      onChange={(e) => setCoverIdLabel(e.target.value)}
                      className="w-full"
                      placeholder='תעודת זהות'
                    />
                  </div>

                  {/* Success Text */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      טקסט סיום (למשל: בהצלחה!)
                    </Label>
                    <Input
                      value={coverSuccessText}
                      onChange={(e) => setCoverSuccessText(e.target.value)}
                      className="w-full"
                      placeholder='בהצלחה!'
                    />
                  </div>
                </div>

                {/* Admin Notifications Section */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    התראות מנהל
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    קבל התראה במייל כשיש יותר מדי בקשות ממתינות
                  </p>
                  
                  {/* Admin Email */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      מייל מנהל המערכת
                    </Label>
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full"
                      placeholder="admin@example.com"
                      dir="ltr"
                    />
                    <p className="text-sm text-muted-foreground">
                      לכתובת זו יישלחו התראות כשמספר הבקשות הממתינות עובר את הסף
                    </p>
                  </div>

                  {/* Pending Threshold */}
                  <div className="space-y-3 mb-6">
                    <Label className="text-base font-medium">
                      סף התראה (מספר בקשות ממתינות): {pendingAlertThreshold}
                    </Label>
                    <Slider
                      value={[pendingAlertThreshold]}
                      onValueChange={(val) => setPendingAlertThreshold(val[0])}
                      min={1}
                      max={20}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground">
                      כשמספר הבקשות הממתינות יגיע ל-{pendingAlertThreshold} או יותר, תישלח התראה למייל
                    </p>
                  </div>
                </div>

                {/* Courses Management Section */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    ניהול קורסים
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    הקורסים שתגדיר כאן יופיעו בתפריט הבחירה בטופס בקשת הקבצים
                  </p>
                  <CourseManager />
                </div>

                {/* Save Button */}
                <Button
                  onClick={saveSettings}
                  disabled={isSaving || isLoading}
                  className="w-full h-12 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                >
                  {isSaving ? "שומר..." : "שמור הגדרות"}
                </Button>
              </div>
            </Card>

            {/* Preview Panel */}
            <Card className="p-8 shadow-lg border-border/50 space-y-8">
              {/* Cover Page Preview */}
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-6">
                  תצוגה מקדימה - דף כריכה
                </h2>
                <div className="relative border-2 border-border rounded-lg bg-white aspect-[3/4] overflow-hidden">
                  {/* Cover Page Background */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-[40%]"
                    style={{ backgroundColor: 'rgb(247, 247, 250)' }}
                  />
                  
                  {/* Title */}
                  <div className="absolute top-[30%] left-0 right-0 text-center">
                    <h2 
                      className="text-xl md:text-2xl font-bold mb-2"
                      style={{ color: 'rgb(51, 51, 77)' }}
                    >
                      חזרה על החומר אלגברת היחסים
                    </h2>
                    <div 
                      className="mx-auto w-2/5 h-0.5"
                      style={{ backgroundColor: 'rgb(77, 102, 153)' }}
                    />
                  </div>

                  {/* User Details */}
                  <div className="absolute top-[50%] left-0 right-0 px-8 text-right" dir="rtl">
                    <div className="mb-4">
                      <span 
                        className="font-bold text-sm md:text-base"
                        style={{ color: 'rgb(77, 77, 102)' }}
                      >
                        {coverEmailLabel}:
                      </span>
                      <span 
                        className="mr-2 text-sm md:text-base"
                        style={{ color: 'rgb(102, 102, 128)' }}
                      >
                        example@email.com
                      </span>
                    </div>
                    <div>
                      <span 
                        className="font-bold text-sm md:text-base"
                        style={{ color: 'rgb(77, 77, 102)' }}
                      >
                        {coverIdLabel}:
                      </span>
                      <span 
                        className="mr-2 text-sm md:text-base"
                        style={{ color: 'rgb(102, 102, 128)' }}
                      >
                        123456789
                      </span>
                    </div>
                  </div>

                  {/* Success Message */}
                  <div className="absolute bottom-[15%] left-0 right-0 text-center">
                    <span 
                      className="text-lg md:text-xl font-bold"
                      style={{ color: 'rgb(77, 128, 179)' }}
                    >
                      {coverSuccessText}
                    </span>
                  </div>

                  {/* Decorative Dots */}
                  <div 
                    className="absolute bottom-[15%] left-[25%] w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'rgb(77, 128, 179)' }}
                  />
                  <div 
                    className="absolute bottom-[15%] right-[25%] w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'rgb(77, 128, 179)' }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  דף הכריכה מוצג לפני תוכן הקובץ המקורי. שם הקובץ מופיע כפי שנשמר במערכת.
                </p>
              </div>

              {/* Watermark Preview */}
              <div className="pt-6 border-t border-border">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold text-foreground">
                    תצוגה מקדימה - Watermarks
                  </h2>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-foreground">הצג נסתרים</Label>
                    <Button
                      variant={showHiddenPreview ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowHiddenPreview(!showHiddenPreview)}
                    >
                      {showHiddenPreview ? "מוצג" : "מוסתר"}
                    </Button>
                  </div>
                </div>
                <div className="relative border-2 border-border rounded-lg bg-white aspect-[3/4] overflow-hidden">
                  {/* Sample PDF Content */}
                  <div className="p-8 text-gray-800">
                    <h3 className="text-xl font-bold mb-4">דף לדוגמה</h3>
                    <p className="text-sm leading-relaxed mb-3">
                      זהו דף דוגמה להצגת מיקומי Watermark. התוכן כאן מדמה קובץ PDF אמיתי עם טקסט ותוכן.
                    </p>
                    <p className="text-sm leading-relaxed mb-3">
                      ניתן לראות כאן את מיקומי ה-Watermarks השונים ואת המראה שלהם על גבי התוכן.
                    </p>
                    <p className="text-sm leading-relaxed">
                      ה-Watermarks יופיעו במיקומים שבחרת ובהגדרות שהתאמת.
                    </p>
                  </div>

                  {/* Visible Watermarks Preview */}
                  {watermarkPositions.map(
                    (pos) =>
                      pos.enabled && (
                        <div
                          key={pos.type}
                          style={getWatermarkStyle(pos.type)}
                        >
                          example@email.com | ID: 123456789
                        </div>
                      )
                  )}

                  {/* Hidden Watermarks Preview */}
                  {hiddenEnabled && showHiddenPreview && (() => {
                    const previewWidth = 600; // Approximate width for calculation
                    const previewHeight = 800; // Approximate height for calculation
                    const emailPrefix = "example";
                    const textWidth = emailPrefix.length * hiddenFontSize * 0.6;
                    const repeatsPerRow = Math.floor(previewWidth / (textWidth + hiddenColSpacing));
                    const hiddenWatermarks = [];

                    for (let row = 0; row < hiddenRowSpacing; row++) {
                      const y = (previewHeight * ((row + 1) / (hiddenRowSpacing + 1))) / previewHeight * 100;
                      
                      for (let col = 0; col < repeatsPerRow; col++) {
                        const x = (col * (textWidth + hiddenColSpacing) + 10) / previewWidth * 100;
                        hiddenWatermarks.push(
                          <div
                            key={`hidden-${row}-${col}`}
                            style={{
                              position: "absolute",
                              top: `${y}%`,
                              left: `${x}%`,
                              fontSize: `${hiddenFontSize}px`,
                              opacity: showHiddenPreview ? 0.5 : hiddenOpacity,
                              color: "#aaa",
                              pointerEvents: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {emailPrefix}
                          </div>
                        );
                      }
                    }
                    return hiddenWatermarks;
                  })()}
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  זוהי תצוגה מקדימה בלבד. ה-Watermarks בקובץ ה-PDF האמיתי יהיו זהים.
                </p>
              </div>
            </Card>
          </div>
              </TabsContent>
            )}

            <TabsContent value="courses">
              <CourseManager />
            </TabsContent>

            {isEditor && !isAdmin && (
              <TabsContent value="my-settings">
                <Card className="p-8 shadow-lg border-border/50 space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-6 text-foreground">
                      הגדרות אישיות
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      הגדר את פרטי השולח עבור המיילים שנשלחים למשתמשים שלך
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="sender-email">כתובת מייל שולח</Label>
                      <Input
                        id="sender-email"
                        type="email"
                        placeholder="your@email.com"
                        value={editorSettings?.sender_email || ""}
                        onChange={(e) => updateEditorSettings({ sender_email: e.target.value })}
                        dir="ltr"
                        className="text-left"
                      />
                      <p className="text-xs text-muted-foreground">
                        כתובת המייל שתופיע כשולח בעת שליחת קבצים ללקוחות
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="sender-name">שם השולח</Label>
                      <Input
                        id="sender-name"
                        type="text"
                        placeholder="שם העסק/הקורס"
                        value={editorSettings?.sender_name || ""}
                        onChange={(e) => updateEditorSettings({ sender_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button onClick={() => {
                    toast({
                      title: "ההגדרות נשמרו",
                      description: "הגדרות השולח עודכנו בהצלחה",
                    });
                  }}>
                    שמור הגדרות
                  </Button>
                </Card>
              </TabsContent>
            )}

            {isAdmin && (
              <>
                <TabsContent value="api">
                  <ApiKeysManager />
                </TabsContent>

                <TabsContent value="webhooks">
                  <WebhooksManager />
                </TabsContent>

                <TabsContent value="alerts">
                  <Card className="p-8 shadow-lg border-border/50 space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold mb-6 text-foreground">
                        <Bell className="w-6 h-6 inline-block ml-2" />
                        הגדרות התראות
                      </h2>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">מייל מנהל להתראות</Label>
                        <Input
                          id="admin-email"
                          type="email"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          dir="ltr"
                          className="text-left"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>סף התראה לבקשות ממתינות: {pendingAlertThreshold}</Label>
                        <Slider
                          value={[pendingAlertThreshold]}
                          onValueChange={(val) => setPendingAlertThreshold(val[0])}
                          min={1}
                          max={20}
                          step={1}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          כאשר מספר הבקשות הממתינות יעבור את הסף, תישלח התראה למייל המנהל
                        </p>
                      </div>
                    </div>

                    <Button onClick={saveSettings} disabled={isSaving}>
                      {isSaving ? "שומר..." : "שמור הגדרות"}
                    </Button>
                  </Card>
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Settings;
