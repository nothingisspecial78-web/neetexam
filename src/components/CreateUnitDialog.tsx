import { useState } from "react";
import { toast } from "sonner";
import { FolderPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreateUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (unitId?: string) => void;
  userId: string;
}

export function CreateUnitDialog({ open, onOpenChange, onCreated, userId }: CreateUnitDialogProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) {
      toast.error("يرجى كتابة اسم الوحدة");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("units")
        .insert({
          owner_id: userId,
          name: trimmed,
          topic_area: trimmed,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("توجد وحدة بهذا الاسم لديك بالفعل");
        } else {
          toast.error("تعذّر إنشاء الوحدة: " + error.message);
        }
        return;
      }

      toast.success(`تم إنشاء وحدة «${trimmed}» بنجاح! 🎉`);
      setName("");
      onOpenChange(false);
      onCreated(data?.id);
    } catch {
      toast.error("حدث خطأ أثناء إنشاء الوحدة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md p-6" dir="rtl">
        <DialogHeader className="text-right">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderPlus className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold">إضافة وحدة دراسية جديدة</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground text-right">
            أنشئ وحدة جديدة لتنظيم أسئلتك، وستتمكن فور إنشائها من رفع ملفات md الخاصة بها.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-2">
          <label className="text-xs font-semibold text-foreground">اسم الوحدة الدراسية</label>
          <Input
            id="new-unit-name-input"
            autoFocus
            placeholder="مثال: البلاغة العربية، شعر المعلقات، النحو والصرف"
            className="h-12 rounded-xl"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            className="rounded-xl h-11"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
          <Button
            id="submit-create-unit-btn"
            className="rounded-xl h-11 px-5 font-semibold gap-2 shadow-xs"
            disabled={busy || !name.trim()}
            onClick={handleCreate}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ الإنشاء…
              </>
            ) : (
              "إضافة الوحدة"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
