import { Button } from "@/components/ui/button";
import { Send, X, CheckSquare } from "lucide-react";

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkSend: () => void;
  isSending: boolean;
}

export const BulkActionsToolbar = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkSend,
  isSending,
}: BulkActionsToolbarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-foreground/20 rounded-lg px-3 py-1.5">
            <span className="font-bold text-lg">{selectedCount}</span>
            <span className="text-sm mr-1">נבחרו</span>
          </div>
          
          {selectedCount < totalCount && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectAll}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <CheckSquare className="w-4 h-4 ml-1" />
              בחר הכל ({totalCount})
            </Button>
          )}
        </div>

        <div className="h-8 w-px bg-primary-foreground/30" />

        <div className="flex items-center gap-2">
          <Button
            onClick={onBulkSend}
            disabled={isSending}
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2"
          >
            {isSending ? (
              <>
                <span className="animate-spin">⏳</span>
                מעבד...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                שלח קבצים לכולם
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
