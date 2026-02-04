import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

interface EditorSettings {
  id: string;
  user_id: string;
  sender_email: string | null;
  sender_name: string | null;
}

export const useEditorSettings = () => {
  const { userId, isEditor, isAdmin, isLoading: isRoleLoading } = useUserRole();
  const [settings, setSettings] = useState<EditorSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (isRoleLoading || !userId) {
        return;
      }

      // Only editors need their own settings
      if (!isEditor) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("editor_settings")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching editor settings:", error);
        } else if (data) {
          setSettings(data);
        } else {
          // Create default settings for editor
          const { data: newSettings, error: createError } = await supabase
            .from("editor_settings")
            .insert({ user_id: userId })
            .select()
            .single();

          if (createError) {
            console.error("Error creating editor settings:", createError);
          } else {
            setSettings(newSettings);
          }
        }
      } catch (error) {
        console.error("Error in useEditorSettings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [userId, isEditor, isRoleLoading]);

  const updateSettings = async (updates: Partial<EditorSettings>) => {
    if (!settings?.id) return false;

    try {
      const { error } = await supabase
        .from("editor_settings")
        .update(updates)
        .eq("id", settings.id);

      if (error) throw error;

      setSettings((prev) => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (error) {
      console.error("Error updating editor settings:", error);
      return false;
    }
  };

  return {
    settings,
    isLoading: isLoading || isRoleLoading,
    updateSettings,
  };
};
