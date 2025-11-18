import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoutButton } from "@/components/LogoutButton";
import { ArrowRight, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface WatermarkPosition {
  type: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center";
  enabled: boolean;
}

const Settings = () => {
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
    // This will save to database in future implementation
    console.log("Saving watermark settings:", {
      positions: watermarkPositions,
      fontSize,
      opacity,
      centerRotation,
    });
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
                הגדרות Watermark
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                התאם את המראה והמיקום של ה-Watermarks הגלויים
              </p>
            </div>
          </div>

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

                {/* Save Button */}
                <Button
                  onClick={saveSettings}
                  className="w-full h-12 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                >
                  שמור הגדרות
                </Button>
              </div>
            </Card>

            {/* Preview Panel */}
            <Card className="p-8 shadow-lg border-border/50">
              <div>
                <h2 className="text-2xl font-semibold mb-6 text-foreground">
                  תצוגה מקדימה
                </h2>
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

                  {/* Watermarks Preview */}
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
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  זוהי תצוגה מקדימה בלבד. ה-Watermarks בקובץ ה-PDF האמיתי יהיו זהים.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
