import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, X, Edit2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface RecipientData {
  email: string;
  id: string;
}

interface BatchEmailImportProps {
  onRecipientsImport: (recipients: RecipientData[]) => void;
  recipients: RecipientData[];
}

export const BatchEmailImport = ({ onRecipientsImport, recipients }: BatchEmailImportProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editId, setEditId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      // Parse Excel data - looking for Email and ID columns
      const parsedRecipients: RecipientData[] = jsonData
        .map((row) => {
          const email = row["Email"] || row["email"] || row["מייל"] || "";
          const id = row["ID"] || row["id"] || row["תז"] || row["תעודת זהות"] || "";
          
          return {
            email: String(email).trim(),
            id: String(id).trim(),
          };
        })
        .filter((r) => r.email && r.id);

      if (parsedRecipients.length === 0) {
        toast({
          title: "שגיאה",
          description: "לא נמצאו שורות תקינות בקובץ. וודא שיש עמודות Email ו-ID",
          variant: "destructive",
        });
        return;
      }

      onRecipientsImport(parsedRecipients);
      toast({
        title: "ייבוא הצליח!",
        description: `${parsedRecipients.length} נמענים יובאו מהקובץ`,
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Excel import error:", error);
      toast({
        title: "שגיאה בייבוא",
        description: "לא ניתן לקרוא את קובץ האקסל",
        variant: "destructive",
      });
    }
  };

  const handleRemoveRecipient = (index: number) => {
    const updated = recipients.filter((_, i) => i !== index);
    onRecipientsImport(updated);
    toast({
      description: "נמען הוסר מהרשימה",
    });
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditEmail(recipients[index].email);
    setEditId(recipients[index].id);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    
    const updated = [...recipients];
    updated[editingIndex] = { email: editEmail, id: editId };
    onRecipientsImport(updated);
    setEditingIndex(null);
    toast({
      description: "נמען עודכן",
    });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditEmail("");
    setEditId("");
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">ייבוא רשימת נמענים</h2>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            יבא מאקסל
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />

        <p className="text-sm text-muted-foreground">
          העלה קובץ Excel עם עמודות: <strong>Email</strong> ו-<strong>ID</strong> (או תז)
        </p>

        {recipients.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">מייל</TableHead>
                  <TableHead className="text-right">תעודת זהות</TableHead>
                  <TableHead className="text-center w-24">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((recipient, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        recipient.email
                      )}
                    </TableCell>
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          value={editId}
                          onChange={(e) => setEditId(e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        recipient.id
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        {editingIndex === index ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={saveEdit}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                              className="h-8 w-8 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(index)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveRecipient(index)}
                              className="h-8 w-8 p-0 text-destructive"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {recipients.length > 0 && (
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>סה"כ נמענים: {recipients.length}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRecipientsImport([])}
              className="text-destructive"
            >
              נקה הכל
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
