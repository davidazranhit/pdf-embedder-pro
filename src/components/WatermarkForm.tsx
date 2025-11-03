import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, IdCard } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface WatermarkFormProps {
  email: string;
  userId: string;
  onEmailChange: (email: string) => void;
  onUserIdChange: (userId: string) => void;
  sendWithoutWatermark: boolean;
  onSendWithoutWatermarkChange: (value: boolean) => void;
}

export const WatermarkForm = ({
  email,
  userId,
  onEmailChange,
  onUserIdChange,
  sendWithoutWatermark,
  onSendWithoutWatermarkChange,
}: WatermarkFormProps) => {
  const [useGmailSuffix, setUseGmailSuffix] = useState(false);

  const handleEmailChange = (value: string) => {
    if (useGmailSuffix) {
      // Remove @ symbol if user tries to type it
      const username = value.replace('@', '').replace('@gmail.com', '');
      onEmailChange(username + '@gmail.com');
    } else {
      onEmailChange(value);
    }
  };

  const handleGmailToggle = (checked: boolean) => {
    setUseGmailSuffix(checked);
    if (checked) {
      // Convert current email to Gmail format
      const username = email.split('@')[0];
      onEmailChange(username + '@gmail.com');
    }
  };

  const displayValue = useGmailSuffix ? email.replace('@gmail.com', '') : email;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4" />
            כתובת מייל
          </Label>
          <div className="space-y-2">
            <div className="relative">
              <Input
                id="email"
                type="text"
                placeholder={useGmailSuffix ? "username" : "example@email.com"}
                value={displayValue}
                onChange={(e) => handleEmailChange(e.target.value)}
                required
                className={useGmailSuffix ? "bg-background pr-28" : "bg-background"}
              />
              {useGmailSuffix && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-sm">
                  @gmail.com
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gmail-suffix"
                checked={useGmailSuffix}
                onCheckedChange={handleGmailToggle}
              />
              <label
                htmlFor="gmail-suffix"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                השתמש בסיומת @gmail.com
              </label>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="userId" className="text-foreground flex items-center gap-2">
            <IdCard className="w-4 h-4" />
            מזהה משתמש (ID)
          </Label>
          <Input
            id="userId"
            type="text"
            placeholder="USER-12345"
            value={userId}
            onChange={(e) => onUserIdChange(e.target.value)}
            required
            className="bg-background"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 border border-border rounded-lg bg-muted/30">
        <Checkbox
          id="no-watermark"
          checked={sendWithoutWatermark}
          onCheckedChange={onSendWithoutWatermarkChange}
        />
        <label
          htmlFor="no-watermark"
          className="text-sm font-medium cursor-pointer"
        >
          שלח קבצים ללא הטמעת Watermark (קבצים מקוריים)
        </label>
      </div>
    </div>
  );
};
