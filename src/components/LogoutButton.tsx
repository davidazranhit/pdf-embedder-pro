import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { LogOut } from "lucide-react";

export const LogoutButton = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      // If server says session not found, still clear locally and proceed
      if (error && error.code !== 'session_not_found' && error.message !== 'No current session') {
        toast({ title: 'שגיאה', description: 'לא ניתן להתנתק', variant: 'destructive' });
        return;
      }

      // Ensure local session cleared regardless
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      // As a fallback, continue to login even if an error occurred
      console.error('Logout error:', e);
    } finally {
      navigate('/sys-admin/login');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      className="gap-2"
    >
      <LogOut className="w-4 h-4" />
      התנתק
    </Button>
  );
};