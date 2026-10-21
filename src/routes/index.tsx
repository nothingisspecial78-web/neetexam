import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, Layers, Swords, Users, Upload, Trophy, Flame, Star } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        throw redirect({ to: "/app" });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "مِدْرَاس — تدرّب على اختبار الأدب العربي" },
      { name: "description", content: "ارفع أسئلتك، تدرّب حسب الوحدات، ونافس زملاءك في مبارزات مباشرة." },
      { property: "og:title", content: "مِدْرَاس — تدرّب على اختبار الأدب العربي" },
      { property: "og:description", content: "ارفع أسئلتك، تدرّب حسب الوحدات، ونافس زملاءك في مبارزات مباشرة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Upload,
    title: "ارفع أسئلتك",
    text: "ارفع ملفاتك ويتولّى الذكاء الاصطناعي تدقيقها وتنظيمها تلقائيًا.",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  {
    icon: Layers,
    title: "وحدات منظّمة",
    text: "تُجمع الأسئلة تلقائيًا حسب الموضوع وتتابع تقدّمك في كل وحدة.",
    color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  {
    icon: Users,
    title: "شارك مع الأصدقاء",
    text: "أضف أصدقاءك ويُدمج بنك أسئلتهم مع بنكك تلقائيًا.",
    color: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  {
    icon: Swords,
    title: "مبارزات دقيقة",
    text: "نافس زميلًا في دقيقة واحدة، اربح النقاط وتصدّر القائمة.",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
];

const stats = [
  { icon: Trophy, value: "١٠٠+", label: "طالب نشط" },
  { icon: BookOpen, value: "٥٠٠٠+", label: "سؤال مرفوع" },
  { icon: Flame, value: "٢٠+", label: "مبارزة يوميًا" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ── Hero ── */}
      <section className="bg-hero relative overflow-hidden px-6 pb-24 pt-20 text-center text-white">
        {/* Arabesque pattern overlay */}
        <div className="pattern-arabesque absolute inset-0 opacity-10" aria-hidden />
        {/* Radial glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/4 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #6EE7B7 0%, transparent 70%)" }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-lg animate-fade-in-up">
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <Star className="h-3.5 w-3.5 fill-current text-yellow-300" />
            للاستعداد لاختبار الأدب العربي
          </span>

          {/* App name */}
          <h1 className="mt-5 font-display text-6xl font-bold leading-none tracking-tight">
            مِدْرَاس
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/85">
            تعلّم من أسئلتك الخاصة،<br />وتحدَّ أصدقاءك في مبارزات مباشرة.
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-14 w-full max-w-xs rounded-2xl bg-white text-emerald-800 text-base font-bold shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all duration-150"
            >
              <Link to="/auth" search={{ mode: "signup" }}>إنشاء حساب مجاني</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 w-full max-w-xs rounded-2xl text-white/90 hover:bg-white/10 hover:text-white border border-white/20"
            >
              <Link to="/auth" search={{ mode: "login" }}>تسجيل الدخول</Link>
            </Button>
          </div>
        </div>

        {/* Stats row — floats over the section bottom */}
        <div className="relative mx-auto mt-14 max-w-sm">
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-white/20 rounded-2xl border border-white/15 bg-white/10 px-2 py-4 backdrop-blur-sm">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1 px-2">
                <s.icon className="h-5 w-5 text-yellow-300" />
                <span className="text-xl font-bold">{s.value}</span>
                <span className="text-xs text-white/70">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="mx-auto max-w-2xl px-4 py-16">
        <h2 className="mb-2 text-center font-display text-3xl font-bold text-foreground">
          كل ما تحتاجه للتحضير
        </h2>
        <p className="mb-10 text-center text-muted-foreground">
          من رفع الأسئلة إلى المنافسة — كل شيء في مكان واحد.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`animate-fade-in-up stagger-${i + 1} group flex items-start gap-4 rounded-2xl border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft`}
            >
              <div className={`shrink-0 rounded-xl p-3 ${f.color}`}>
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Gamification Teaser ── */}
      <section className="bg-hero relative overflow-hidden px-6 py-16 text-white">
        <div className="pattern-arabesque absolute inset-0 opacity-10" aria-hidden />
        <div className="relative mx-auto max-w-md text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400 shadow-lg">
            <Trophy className="h-8 w-8 text-yellow-900" />
          </div>
          <h2 className="font-display text-3xl font-bold">نظام المكافآت</h2>
          <p className="mt-3 text-white/80 leading-relaxed">
            اكسب نقاطًا، احافظ على سلسلتك اليومية، وتصدّر القائمة من خلال مبارزات مباشرة مع زملائك.
          </p>
          <div className="mt-8 flex justify-center gap-6 text-center">
            {[
              { emoji: "🪙", label: "نقاط الرصيد" },
              { emoji: "🔥", label: "الأيام المتتالية" },
              { emoji: "🏆", label: "شارات الإنجاز" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <span className="text-3xl">{item.emoji}</span>
                <span className="text-xs text-white/70">{item.label}</span>
              </div>
            ))}
          </div>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 rounded-2xl bg-yellow-400 text-yellow-900 font-bold hover:bg-yellow-300 active:scale-[0.98] transition-all duration-150"
          >
            <Link to="/auth" search={{ mode: "signup" }}>ابدأ الآن — مجاني تمامًا</Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        <p className="font-display text-lg font-bold text-foreground">مِدْرَاس</p>
        <p className="mt-1">© {new Date().getFullYear()} — جميع الحقوق محفوظة</p>
      </footer>
    </div>
  );
}
