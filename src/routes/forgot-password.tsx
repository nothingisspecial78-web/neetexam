import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "استعادة كلمة المرور — مِدْرَاس" },
      { name: "description", content: "أرسل رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني." },
      { property: "og:title", content: "استعادة كلمة المرور — مِدْرَاس" },
      { property: "og:description", content: "أرسل رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("تعذّر إرسال رابط الاستعادة، تأكد من صحة البريد وحاول لاحقًا");
    } else {
      setSent(true);
      toast.success("تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني");
    }
  }

  return (
    <AuthShell
      title="استعادة كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا لتعيين كلمة مرور جديدة"
    >
      {sent ? (
        <div className="text-center space-y-4 py-3 animate-in fade-in-50 duration-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-sm text-foreground font-semibold">
            تم إرسال رسالة الاستعادة إلى <span dir="ltr" className="font-mono text-primary">{email}</span>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            تفقّد صندوق الوارد أو مجلد الرسائل غير المرغوب فيها (Spam) واضغط على الرابط للمتابعة.
          </p>
          <Button asChild variant="outline" className="w-full rounded-xl">
            <Link to="/auth" search={{ mode: "login" }}>
              العودة لتسجيل الدخول
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-primary" />
              البريد الإلكتروني
            </label>
            <Input
              required
              type="email"
              dir="ltr"
              placeholder="student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl text-start"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-bold gap-2">
            <KeyRound className="h-4 w-4" />
            <span>{loading ? "جارٍ الإرسال…" : "إرسال رابط إعادة التعيين"}</span>
          </Button>

          <div className="pt-2 text-center">
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <span>العودة لتسجيل الدخول</span>
              <ArrowRight className="h-3.5 w-3.5 ltr:rotate-180" />
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
