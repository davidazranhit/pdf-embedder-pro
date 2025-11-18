import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogoutButton } from "@/components/LogoutButton";
import { ArrowRight, Settings as SettingsIcon, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PositionSetting {
  type: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center";
  enabled: boolean;
  fontSize: number;
  opacity: number;
  rotation: number;
}

const Settings = () => {
  const { toast } = useToast();
  const [positionSettings, setPositionSettings] = useState<PositionSetting[]>([
    { type: "top-right", enabled: true, fontSize: 10, opacity: 0.4, rotation: 0 },
    { type: "top-left", enabled: false, fontSize: 10, opacity: 0.4, rotation: 0 },
    { type: "bottom-right", enabled: true, fontSize: 10, opacity: 0.4, rotation: 0 },
    { type: "bottom-left", enabled: true, fontSize: 10, opacity: 0.4, rotation: 0 },
    { type: "center", enabled: true, fontSize: 10, opacity: 0.4, rotation: 45 },
  ]);
  
  const [hiddenEnabled, setHiddenEnabled] = useState<boolean>(true);
  const [hiddenFontSize, setHiddenFontSize] = useState<number>(4);
  const [hiddenOpacity, setHiddenOpacity] = useState<number>(0.02);
  const [hiddenRowSpacing, setHiddenRowSpacing] = useState<number>(100);
  const [hiddenColSpacing, setHiddenColSpacing] = useState<number>(150);
  const [showHiddenPreview, setShowHiddenPreview] = useState<boolean>(false);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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
        if (data.position_settings) {
          setPositionSettings(data.position_settings as unknown as PositionSetting[]);
        }
        setHiddenEnabled(data.hidden_watermark_enabled ?? true);
        setHiddenFontSize(data.hidden_watermark_font_size ?? 4);
        setHiddenOpacity(Number(data.hidden_watermark_opacity) ?? 0.02);
        setHiddenRowSpacing(data.hidden_watermark_row_spacing ?? 100);
        setHiddenColSpacing(data.hidden_watermark_col_spacing ?? 150);
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

  const updatePositionSetting = (
    type: string,
    field: keyof PositionSetting,
    value: boolean | number
  ) => {
    setPositionSettings((prev) =>
      prev.map((pos) =>
        pos.type === type ? { ...pos, [field]: value } : pos
      )
    );
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("watermark_settings")
        .update({
          position_settings: positionSettings as any,
          hidden_watermark_enabled: hiddenEnabled,
          hidden_watermark_font_size: hiddenFontSize,
          hidden_watermark_opacity: hiddenOpacity,
          hidden_watermark_row_spacing: hiddenRowSpacing,
          hidden_watermark_col_spacing: hiddenColSpacing,
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

  const getWatermarkStyle = (position: PositionSetting): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      fontSize: `${position.fontSize}px`,
      opacity: position.opacity,
      color: "#888",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      transform: `rotate(${position.rotation}deg)`,
    };

    switch (position.type) {
      case "top-right":
        return { ...baseStyle, top: "20px", right: "100px" };
      case "top-left":
        return { ...baseStyle, top: "20px", left: "100px" };
      case "bottom-right":
        return { ...baseStyle, bottom: "20px", right: "100px" };
      case "bottom-left":
        return { ...baseStyle, bottom: "20px", left: "100px" };
      case "center":
        return {
          ...baseStyle,
          top: "calc(50% + 50px)",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(${position.rotation}deg)`,
        };
      default:
        return baseStyle;
    }
  };

  const renderHiddenWatermarks = () => {
    if (!hiddenEnabled) return null;
    
    const watermarks = [];
    const previewOpacity = showHiddenPreview ? hiddenOpacity * 30 : hiddenOpacity;
    
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        watermarks.push(
          <div
            key={`hidden-${row}-${col}`}
            style={{
              position: "absolute",
              top: `${row * hiddenRowSpacing + 50}px`,
              left: `${col * hiddenColSpacing + 50}px`,
              fontSize: `${hiddenFontSize}px`,
              opacity: previewOpacity,
              color: "#888",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            example@mail
          </div>
        );
      }
    }
    return watermarks;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">טוען הגדרות...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/sys-admin">
              <Button variant="outline" size="sm">
                <ArrowRight className="h-4 w-4 ml-2" />
                חזרה לדף הראשי
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-6 w-6" />
              <h1 className="text-3xl font-bold">הגדרות Watermark</h1>
            </div>
          </div>
          <LogoutButton />
        </div>

        <Tabs defaultValue="visible" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="visible">Watermarks גלויים</TabsTrigger>
            <TabsTrigger value="hidden">Watermarks מוסתרים</TabsTrigger>
          </TabsList>

          <TabsContent value="visible" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 space-y-6">
                <h2 className="text-xl font-semibold mb-4">הגדרות לפי מיקום</h2>
                
                {positionSettings.map((pos) => (
                  <div key={pos.type} className="space-y-4 pb-6 border-b border-border last:border-0">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-medium">{positionLabels[pos.type]}</Label>
                      <Switch
                        checked={pos.enabled}
                        onCheckedChange={(checked) =>
                          updatePositionSetting(pos.type, "enabled", checked)
                        }
                      />
                    </div>

                    {pos.enabled && (
                      <div className="space-y-4 pr-4">
                        <div>
                          <Label className="text-sm">גודל פונט: {pos.fontSize}px</Label>
                          <Slider
                            value={[pos.fontSize]}
                            onValueChange={([value]) =>
                              updatePositionSetting(pos.type, "fontSize", value)
                            }
                            min={6}
                            max={20}
                            step={1}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label className="text-sm">אטימות: {(pos.opacity * 100).toFixed(0)}%</Label>
                          <Slider
                            value={[pos.opacity * 100]}
                            onValueChange={([value]) =>
                              updatePositionSetting(pos.type, "opacity", value / 100)
                            }
                            min={10}
                            max={100}
                            step={5}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label className="text-sm">סיבוב: {pos.rotation}°</Label>
                          <Slider
                            value={[pos.rotation]}
                            onValueChange={([value]) =>
                              updatePositionSetting(pos.type, "rotation", value)
                            }
                            min={-180}
                            max={180}
                            step={15}
                            className="mt-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="w-full"
                  size="lg"
                >
                  {isSaving ? "שומר..." : "שמור הגדרות"}
                </Button>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">תצוגה מקדימה</h2>
                <div className="relative bg-card border-2 border-border rounded-lg overflow-hidden" style={{ width: "100%", paddingTop: "141.4%", minHeight: "500px" }}>
                  <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                    <div className="text-4xl text-muted-foreground/30">דוגמא לעמוד PDF</div>
                  </div>
                  {positionSettings
                    .filter((pos) => pos.enabled)
                    .map((pos) => (
                      <div key={pos.type} style={getWatermarkStyle(pos)}>
                        Mail: example@mail.com | ID: 123456789
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="hidden" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">הגדרות Watermarks מוסתרים</h2>
                  <Switch
                    checked={hiddenEnabled}
                    onCheckedChange={setHiddenEnabled}
                  />
                </div>

                {hiddenEnabled && (
                  <div className="space-y-4">
                    <div>
                      <Label>גודל פונט: {hiddenFontSize}px</Label>
                      <Slider
                        value={[hiddenFontSize]}
                        onValueChange={([value]) => setHiddenFontSize(value)}
                        min={2}
                        max={8}
                        step={1}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>אטימות: {(hiddenOpacity * 100).toFixed(1)}%</Label>
                      <Slider
                        value={[hiddenOpacity * 100]}
                        onValueChange={([value]) => setHiddenOpacity(value / 100)}
                        min={0.5}
                        max={5}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>מרווח בין שורות: {hiddenRowSpacing}px</Label>
                      <Slider
                        value={[hiddenRowSpacing]}
                        onValueChange={([value]) => setHiddenRowSpacing(value)}
                        min={50}
                        max={200}
                        step={10}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>מרווח בין עמודות: {hiddenColSpacing}px</Label>
                      <Slider
                        value={[hiddenColSpacing]}
                        onValueChange={([value]) => setHiddenColSpacing(value)}
                        min={80}
                        max={250}
                        step={10}
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="w-full"
                  size="lg"
                >
                  {isSaving ? "שומר..." : "שמור הגדרות"}
                </Button>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">תצוגה מקדימה</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHiddenPreview(!showHiddenPreview)}
                  >
                    {showHiddenPreview ? (
                      <>
                        <EyeOff className="h-4 w-4 ml-2" />
                        הסתר מוסתרים
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 ml-2" />
                        הצג מוסתרים
                      </>
                    )}
                  </Button>
                </div>
                <div className="relative bg-card border-2 border-border rounded-lg overflow-hidden" style={{ width: "100%", paddingTop: "141.4%", minHeight: "500px" }}>
                  <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                    <div className="text-4xl text-muted-foreground/30">דוגמא לעמוד PDF</div>
                  </div>
                  {renderHiddenWatermarks()}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  {showHiddenPreview
                    ? "תצוגה מוגברת של ה-Watermarks המוסתרים (בפועל הם כמעט בלתי נראים)"
                    : "לחץ על 'הצג מוסתרים' כדי לראות את ה-Watermarks המוסתרים בתצוגה מוגברת"}
                </p>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
