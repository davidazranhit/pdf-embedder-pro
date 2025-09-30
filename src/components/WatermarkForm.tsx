import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, IdCard } from "lucide-react";

interface WatermarkFormProps {
  email: string;
  userId: string;
  onEmailChange: (email: string) => void;
  onUserIdChange: (userId: string) => void;
}

export const WatermarkForm = ({
  email,
  userId,
  onEmailChange,
  onUserIdChange,
}: WatermarkFormProps) => {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4" />
          כתובת אימייל
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="example@email.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          className="bg-background"
        />
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
  );
};
