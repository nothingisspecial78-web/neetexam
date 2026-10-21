import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { destinationAfterLogin } from "@/lib/post-login";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — مِدْرَاس" },
      { name: "description", content: "عيّن كلمة مرور جديدة لحسابك." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة — مِدْرَاس" },
      { property: "og:description", content: "عيّن كلمة مرور جديدة لحسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return void toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
    if (pw !== pw2) return void toast.error("كلمتا المرور غير متطابقتين");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      return void toast.error("انتهت صلاحية الرابط، يرجى طلب رابط جديد من صفحة نسيت كلمة المرور");
    }
    toast.success("تم تحديث كلمة المرور بنجاح");
    navigate({ to: await destinationAfterLogin(), replace: true });
  }

  return (
    <AuthShell
      title="كلمة مرور جديدة"
      subtitle="اختر كلمة مرور قوية لحماية حسابك وبنك أسئلتك"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-primary" />
            كلمة المرور الجديدة (8 أحرف فأكثر)
          </label>
          <div className="relative">
            <Input
              required
              type={show ? "text" : "password"}
              dir="ltr"
              placeholder="••••••••"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="h-11 rounded-xl pe-10"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-primary" />
            تأكيد كلمة المرور
          </label>
          <Input
            required
            type={show ? "text" : "password"}
            dir="ltr"
            placeholder="••••••••"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl font-bold gap-2 mt-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>{loading ? "جارٍ الحفظ…" : "حفظ كلمة المرور الجديدة والبدء"}</span>
        </Button>
      </form>
    </AuthShell>
  );
}
