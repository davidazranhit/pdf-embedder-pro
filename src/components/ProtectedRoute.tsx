import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecked, setIsChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const verify = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!session) {
          setSession(null);
          setIsAuthenticated(false);
          setIsChecked(true);
          setIsLoading(false);
          return;
        }

        // Server-verify token is valid (prevents stale local sessions)
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setIsAuthenticated(false);
        } else {
          setSession(session);
          setIsAuthenticated(true);
        }
      } catch {
        setSession(null);
        setIsAuthenticated(false);
      } finally {
        if (mounted) {
          setIsChecked(true);
          setIsLoading(false);
        }
      }
    };

    verify();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        setSession(null);
        setIsAuthenticated(false);
        setIsChecked(true);
        setIsLoading(false);
        return;
      }

      // On sign in, validate with server
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setIsAuthenticated(false);
        setIsChecked(true);
        setIsLoading(false);
      } else {
        setSession(session);
        setIsAuthenticated(true);
        setIsChecked(true);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading || !isChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">בודק הרשאות...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/sys-admin/login" replace />;
  }

  return <>{children}</>;
};