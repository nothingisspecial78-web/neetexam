import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeleteAccount() {
  const del = useServerFn(deleteMyAccount);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-10 text-center">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="link" className="text-destructive">حذف حسابي</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحساب نهائيًا؟</AlertDialogTitle>
            <AlertDialogDescription>ستُحذف أسئلتك وملفاتك ونتائجك وأصدقاؤك، ويُخفى اسمك من سجلّ المباريات. لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground"
              onClick={async () => {
                setBusy(true);
                try {
                  await del();
                  await supabase.auth.signOut();
                  window.location.href = "/";
                } catch { toast.error("تعذّر حذف الحساب"); setBusy(false); }
              }}
            >
              احذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
