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
          שם משתמש Gmail
        </Label>
        <div className="relative">
          <Input
            id="email"
            type="text"
            placeholder="username"
            value={email.replace('@gmail.com', '')}
            onChange={(e) => {
              const username = e.target.value.replace('@', '');
              onEmailChange(username + '@gmail.com');
            }}
            required
            className="bg-background pr-28"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-sm">
            @gmail.com
          </span>
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
  );
};
