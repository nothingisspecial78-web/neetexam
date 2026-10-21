import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, AlertTriangle, UserX, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/auth.functions";
import { notifyLiveSync } from "@/lib/live-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeleteAccountProps {
  variant?: "card" | "headerButton" | "link";
}

export function DeleteAccount({ variant = "card" }: DeleteAccountProps) {
  const del = useServerFn(deleteMyAccount);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [busy, setBusy] = useState(false);

  const isConfirmed =
    confirmWord.trim() === "حذف" || confirmWord.trim().toLowerCase() === "delete";

  async function handleConfirmDelete() {
    if (!isConfirmed || busy) return;
    setBusy(true);
    try {
      await del();
      notifyLiveSync("account_deleted");
      toast.success("تم حذف حسابك وجميع بياناتك بنجاح");
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر حذف الحساب، حاول مجددًا");
      setBusy(false);
    }
  }

  return (
    <>
      {variant === "card" && (
        <section
          aria-label="إعدادات الحساب ومنطقة الخطر"
          className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 sm:p-6 text-start shadow-xs transition-colors"
          dir="rtl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-destructive font-bold text-base">
                <ShieldAlert className="h-5 w-5" />
                <h3>إدارة الحساب — منطقة الخطر</h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
                عند حذف الحساب، سيتم مسح كافة أسئلتك، وحداتك الدراسية، نتائج الاختبارات، والأصدقاء نهائياً. لن تتمكن من استعادة هذا الحساب لاحقاً.
              </p>
            </div>

            <Button
              id="open-delete-account-btn"
              variant="destructive"
              className="h-11 rounded-xl text-xs sm:text-sm font-bold gap-2 shrink-0 shadow-sm"
              onClick={() => {
                setConfirmWord("");
                setOpen(true);
              }}
            >
              <UserX className="h-4 w-4" />
              <span>حذف حسابي نهائيًا</span>
            </Button>
          </div>
        </section>
      )}

      {variant === "headerButton" && (
        <Button
          id="header-delete-account-btn"
          variant="ghost"
          size="sm"
          className="h-9 px-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-500/20 gap-1.5 transition-colors"
          title="حذف الحساب نهائيًا"
          onClick={() => {
            setConfirmWord("");
            setOpen(true);
          }}
        >
          <UserX className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">حذف الحساب</span>
        </Button>
      )}

      {variant === "link" && (
        <Button
          variant="link"
          className="text-xs text-destructive hover:underline p-0 h-auto"
          onClick={() => {
            setConfirmWord("");
            setOpen(true);
          }}
        >
          حذف حسابي
        </Button>
      )}

      {/* Manual Intent Confirmation Dialog */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) {
            setOpen(v);
            if (!v) setConfirmWord("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-6 sm:p-7" dir="rtl">
          <DialogHeader className="text-center sm:text-start space-y-2">
            <div className="flex items-center gap-2.5 text-destructive">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle className="text-lg sm:text-xl font-bold">
                تأكيد حذف الحساب نهائيًا
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1">
              هذا الإجراء دائم ولا يمكن التراجع عنه. عند المتابعة، سيتم تنفيذ ما يلي:
            </DialogDescription>
          </DialogHeader>

          {/* Impact list */}
          <div className="my-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive-foreground/90 space-y-1.5">
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <span>حذف جميع الأسئلة والمسودات المرفوعة من قِبلك.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <span>حذف كافة الوحدات الدراسية المخصصة وإحصاءات التقدّم.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <span>مسح نتائج الاختبارات، بنك الأخطاء، ورصيد الساحة.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <span>إلغاء ارتباط الصداقات وإخفاء الهوية من سجل المباريات.</span>
            </p>
          </div>

          {/* Manual Intent Protection Requirement */}
          <div className="space-y-2">
            <label htmlFor="confirm-delete-input" className="block text-xs font-semibold text-foreground">
              لتأكيد رغبتك الفعلية، اكتب كلمة <strong className="text-destructive font-mono">«حذف»</strong> أو <strong className="text-destructive font-mono">«delete»</strong> في الحقل أدناه:
            </label>
            <Input
              id="confirm-delete-input"
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder="اكتب حذف هنا لتفعيل الزر…"
              className="h-11 rounded-xl font-medium text-sm text-center"
              autoComplete="off"
            />
          </div>

          <DialogFooter className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              disabled={busy}
              className="h-11 rounded-xl text-xs sm:text-sm font-semibold"
              onClick={() => setOpen(false)}
            >
              إلغاء التراجع
            </Button>
            <Button
              id="confirm-delete-account-btn"
              variant="destructive"
              disabled={!isConfirmed || busy}
              className="h-11 rounded-xl text-xs sm:text-sm font-bold gap-2 shadow-md shadow-destructive/20"
              onClick={handleConfirmDelete}
            >
              <Trash2 className="h-4 w-4" />
              <span>{busy ? "جارٍ حذف الحساب…" : "أؤكد حذف حسابي نهائيًا"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
