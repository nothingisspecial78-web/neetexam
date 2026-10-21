import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MailCheck, RefreshCw, ExternalLink, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/check-email")({
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s["email"] === "string" ? s["email"] : "",
  }),
  head: () => ({
    meta: [
      { title: "تحقق من بريدك — مِدْرَاس" },
      { name: "description", content: "أكّد بريدك الإلكتروني لبدء استخدام مِدْرَاس." },
      { property: "og:title", content: "تحقق من بريدك — مِدْرَاس" },
      { property: "og:description", content: "أكّد بريدك الإلكتروني لبدء استخدام مِدْرَاس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckEmail,
});

const COOLDOWN = 60;

function CheckEmail() {
  const { email } = Route.useSearch();
  const [wait, setWait] = useState(COOLDOWN);
  const isGmail = /@(gmail|googlemail)\.com$/i.test(email);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function resend() {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    if (error) toast.error("تعذّر الإرسال الآن، حاول لاحقًا");
    else toast.success("أُرسل رابط جديد إلى بريدك");
    setWait(COOLDOWN);
  }

  return (
    <AuthShell title="تحقق من بريدك" subtitle="أرسلنا رابط التأكيد إلى بريدك الإلكتروني">
      <div className="text-center animate-fade-in">
        {/* Big envelope illustration */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          <MailCheck className="h-10 w-10" strokeWidth={1.5} />
        </div>

        {/* Email address */}
        <p className="text-sm text-muted-foreground">الرسالة مرسلة إلى</p>
        <p
          className="mt-1 inline-block rounded-lg bg-muted px-3 py-1 font-semibold tracking-wide"
          dir="ltr"
        >
          {email || "بريدك الإلكتروني"}
        </p>

        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          افتح الرسالة واضغط على <strong className="text-foreground">«تأكيد بريدي»</strong>
          {" "}لتفعيل حسابك.
        </p>

        {/* Steps */}
        <ol className="mt-5 space-y-2 text-sm text-start text-muted-foreground">
          {[
            "افتح تطبيق بريدك الإلكتروني",
            "ابحث عن رسالة من مِدْرَاس",
            "اضغط على رابط «تأكيد بريدي»",
          ].map((step, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3">
        {isGmail && (
          <Button id="open-gmail-btn" asChild size="lg" className="h-12 rounded-xl font-semibold">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              فتح Gmail
            </a>
          </Button>
        )}
        {!isGmail && (
          <Button id="open-mail-btn" asChild size="lg" className="h-12 rounded-xl font-semibold">
            <a href="mailto:" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              فتح تطبيق البريد
            </a>
          </Button>
        )}

        <Button
          id="resend-btn"
          variant="outline"
          size="lg"
          className="h-12 rounded-xl"
          disabled={wait > 0 || !email}
          onClick={resend}
        >
          <RefreshCw className={`h-4 w-4 ${wait > 0 ? "" : "animate-spin-once"}`} />
          {wait > 0 ? `إعادة الإرسال بعد ${wait} ث` : "إعادة إرسال الرسالة"}
        </Button>

        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="flex items-center justify-center gap-1 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          تغيير البريد الإلكتروني
        </Link>
      </div>
    </AuthShell>
  );
}
