import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { destinationAfterLogin } from "@/lib/post-login";

type Mode = "login" | "signup";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode: Mode } => ({
    mode: s["mode"] === "signup" ? "signup" : "login",
  }),
  head: () => ({
    meta: [
      { title: "الدخول — مِدْرَاس" },
      { name: "description", content: "سجّل الدخول أو أنشئ حسابًا جديدًا في مِدْرَاس." },
      { property: "og:title", content: "الدخول — مِدْرَاس" },
      { property: "og:description", content: "سجّل الدخول أو أنشئ حسابًا جديدًا في مِدْرَاس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (form.password.length < 8) return void toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
        if (form.password !== form.confirm) return void toast.error("كلمتا المرور غير متطابقتين");
        const { data, error } = await supabase.auth.signUp({
          email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: form.name.trim() },
          },
        });
        if (error) {
          if (/already|registered/i.test(error.message))
            toast.error("الحساب موجود مسبقًا، سجّل الدخول بدلًا من ذلك");
          else toast.error(error.message);
          return;
        }
        if (data.user && data.user.identities?.length === 0) {
          toast.error("الحساب موجود مسبقًا، سجّل الدخول بدلًا من ذلك");
          navigate({ to: "/auth", search: { mode: "login" } });
          return;
        }
        navigate({ to: "/check-email", search: { email } });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: form.password });
        if (error) {
          if (/not confirmed/i.test(error.message)) setUnconfirmed(email);
          else toast.error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
          return;
        }
        navigate({ to: await destinationAfterLogin(), replace: true });
      }
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <AuthShell
      title={isSignup ? "إنشاء حساب جديد" : "مرحبًا بعودتك"}
      subtitle={isSignup ? "ابدأ ببناء بنك أسئلتك" : "سجّل الدخول لمتابعة تقدّمك"}
    >
      {/* Unconfirmed email banner */}
      {unconfirmed && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            يرجى تأكيد بريدك الإلكتروني أولًا.{" "}
            <Link
              to="/check-email"
              search={{ email: unconfirmed }}
              className="font-semibold underline"
            >
              إعادة إرسال الرابط
            </Link>
          </span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {isSignup && (
          <Field label="الاسم الكامل" icon={<User className="h-4 w-4" />}>
            <Input
              id="auth-name"
              required
              autoComplete="name"
              placeholder="اسمك الكامل"
              value={form.name}
              onChange={set("name")}
            />
          </Field>
        )}

        <Field label="البريد الإلكتروني" icon={<Mail className="h-4 w-4" />}>
          <Input
            id="auth-email"
            required
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="example@email.com"
            value={form.email}
            onChange={set("email")}
          />
        </Field>

        <Field
          label="كلمة المرور"
          icon={<Lock className="h-4 w-4" />}
          action={
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        >
          <Input
            id="auth-password"
            required
            type={showPw ? "text" : "password"}
            dir="ltr"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            placeholder={isSignup ? "٨ أحرف على الأقل" : "••••••••"}
            value={form.password}
            onChange={set("password")}
          />
        </Field>

        {isSignup && (
          <Field
            label="تأكيد كلمة المرور"
            icon={<Lock className="h-4 w-4" />}
            action={
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "إخفاء التأكيد" : "إظهار التأكيد"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          >
            <Input
              id="auth-confirm"
              required
              type={showConfirm ? "text" : "password"}
              dir="ltr"
              autoComplete="new-password"
              placeholder="أعد كتابة كلمة المرور"
              value={form.confirm}
              onChange={set("confirm")}
            />
          </Field>
        )}

        <Button
          id="auth-submit"
          type="submit"
          className="mt-2 h-12 w-full rounded-xl text-base font-semibold shadow-sm active:scale-[0.98] transition-all duration-150"
          size="lg"
          disabled={busy}
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              لحظة…
            </span>
          ) : isSignup ? (
            "إنشاء الحساب"
          ) : (
            "تسجيل الدخول"
          )}
        </Button>
      </form>

      {/* Footer links */}
      <div className="mt-5 flex flex-col items-center gap-2.5 text-sm">
        {!isSignup && (
          <Link
            to="/forgot-password"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            نسيت كلمة المرور؟
          </Link>
        )}
        <div className="h-px w-full bg-border" />
        <Link
          to="/auth"
          search={{ mode: isSignup ? "login" : "signup" }}
          className="font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          {isSignup ? "لديك حساب؟ سجّل الدخول" : "ليس لديك حساب؟ أنشئ واحدًا"}
        </Link>
      </div>
    </AuthShell>
  );
}

function Field({
  label,
  icon,
  action,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {label}
        </Label>
        {action}
      </div>
      {children}
    </div>
  );
}
