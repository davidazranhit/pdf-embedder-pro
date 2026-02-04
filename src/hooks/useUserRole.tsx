import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "editor" | "viewer" | "user" | null;

interface UserRoleData {
  role: UserRole;
  userId: string | null;
  isAdmin: boolean;
  isEditor: boolean;
  isLoading: boolean;
}

export const useUserRole = (): UserRoleData => {
  const [role, setRole] = useState<UserRole>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setRole(null);
          setUserId(null);
          setIsLoading(false);
          return;
        }

        setUserId(session.user.id);

        // Fetch user role from user_roles table
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (error) {
          console.error("Error fetching user role:", error);
          setRole("user");
        } else {
          setRole(roleData?.role as UserRole || "user");
        }
      } catch (error) {
        console.error("Error in useUserRole:", error);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setRole(null);
        setUserId(null);
        return;
      }

      setUserId(session.user.id);

      // Refresh role on auth change
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      setRole(roleData?.role as UserRole || "user");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    userId,
    isAdmin: role === "admin",
    isEditor: role === "editor",
    isLoading,
  };
};
