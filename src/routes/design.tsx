import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Sparkles, Check, ChevronLeft, ArrowRight, Sun, Moon, AlignRight, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroContinueCard } from "@/components/dark-theme/HeroContinueCard";
import { StreakWeekCard } from "@/components/dark-theme/StreakWeekCard";
import { DailyGoalCard } from "@/components/dark-theme/DailyGoalCard";
import { FeatureTile } from "@/components/dark-theme/FeatureTile";
import { StatCard } from "@/components/dark-theme/StatCard";

export const Route = createFileRoute("/design")({
  head: () => ({
    meta: [
      { title: "دليل التصميم — مِدْرَاس (Dark Emerald Glow)" },
      { name: "description", content: "معاينة مكونات نظام التصميم Dark Emerald Glow للوضع الداكن والفاتح." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesignShowcase,
});

function DesignShowcase() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [direction, setDirection] = useState<"rtl" | "ltr">("rtl");
  const [searchValue, setSearchValue] = useState("");

  return (
    <div
      dir={direction}
      className={`min-h-screen transition-colors duration-300 ${
        theme === "dark" ? "bg-[#0A1418] text-white dark" : "bg-[#F6FAF8] text-slate-900"
      }`}
    >
      {/* Top Floating Control Bar */}
      <header className="sticky top-0 z-50 border-b border-[#1D3139]/40 bg-[#111E24]/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-[#2DD4A8] shadow-[0_0_12px_#2DD4A8]" />
            <h1 className="font-display text-sm font-bold text-white">
              Dark Emerald "Glow" Theme Showcase
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="h-8 rounded-xl border-[#1D3139] bg-[#162730] text-xs font-semibold text-white hover:border-[#2DD4A8]/40"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400 me-1.5" /> فاتح
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-[#2DD4A8] me-1.5" /> داكن
                </>
              )}
            </Button>

            {/* Direction Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDirection((d) => (d === "rtl" ? "ltr" : "rtl"))}
              className="h-8 rounded-xl border-[#1D3139] bg-[#162730] text-xs font-semibold text-white hover:border-[#2DD4A8]/40"
            >
              {direction === "rtl" ? (
                <>
                  <AlignLeft className="h-3.5 w-3.5 me-1.5" /> LTR
                </>
              ) : (
                <>
                  <AlignRight className="h-3.5 w-3.5 me-1.5" /> RTL
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Showcase */}
      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Header Preview */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#8FA3A0] flex items-center gap-1.5">
                مرحباً بك! <span>👋</span>
              </p>
              <h2 className="font-display text-3xl font-extrabold tracking-tight mt-0.5">
                تعلم العربية
              </h2>
              <p className="text-sm font-bold text-[#2DD4A8] mt-0.5">
                بسهولة و متعة
              </p>
            </div>
            <div className="rounded-2xl border border-[#1D3139] bg-[#111E24] px-4 py-2 text-center shadow-md">
              <span className="block text-[10px] text-[#8FA3A0] font-bold">النقاط</span>
              <span className="font-display text-lg font-black text-[#F5B942]">1,250 🪙</span>
            </div>
          </div>
        </section>

        {/* Search Bar */}
        <section>
          <div className="relative">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8FA3A0] rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="ابحث عن درس أو وحدة أو سؤال..."
              className="h-13 w-full rounded-2xl border border-[#1D3139] bg-[#162730] py-2.5 text-sm font-medium text-white placeholder:text-[#8FA3A0] focus:border-[#14B58C] focus:outline-hidden focus:ring-2 focus:ring-[#14B58C]/20 rtl:pr-12 rtl:pl-4 ltr:pl-12 ltr:pr-4 transition-all"
            />
          </div>
        </section>

        {/* Hero Continue Card */}
        <section className="space-y-2">
          <span className="text-xs font-bold text-[#8FA3A0] block">5.3 Hero "Continue" Card</span>
          <HeroContinueCard
            unitName="العصر الجاهلي وصناع المعلقات"
            progressPercent={85}
            levelText="مستوى متقدم"
            onContinue={() => alert("متابعة الدرس!")}
          />
        </section>

        {/* Streak and Weekly Strip */}
        <section className="space-y-2">
          <span className="text-xs font-bold text-[#8FA3A0] block">5.5 Streak & Weekly Strip Card</span>
          <StreakWeekCard streakDays={4} />
        </section>

        {/* Daily Goal Card */}
        <section className="space-y-2">
          <span className="text-xs font-bold text-[#8FA3A0] block">5.6 Daily Goal Card</span>
          <DailyGoalCard currentCount={20} targetCount={20} />
        </section>

        {/* 2-Column Feature Tiles */}
        <section className="space-y-2">
          <span className="text-xs font-bold text-[#8FA3A0] block">5.7 Feature Tiles (2-Column Grid)</span>
          <div className="grid grid-cols-2 gap-3.5">
            <FeatureTile
              title="اختبارات ذكية"
              description="اختبر معلوماتك بدقة وتدرج"
              imageSrc="/illustrations/quiz_bubble.jpg"
              imageAlt="اختبارات ذكية"
              accentColor="blue"
              onClick={() => {}}
            />
            <FeatureTile
              title="استمع وتعلّم"
              description="دروس صوتية تساعدك فهماً أعمق"
              imageSrc="/illustrations/headphones.jpg"
              imageAlt="استمع وتعلم"
              accentColor="purple"
              onClick={() => {}}
            />
            <FeatureTile
              title="الوحدات الدراسية"
              description="استكشف الفصول والموضوعات"
              imageSrc="/illustrations/quiz_bubble.jpg"
              imageAlt="الوحدات"
              accentColor="emerald"
              onClick={() => {}}
            />
            <FeatureTile
              title="حلبة المنافسة"
              description="نافس زملاءك في تحدي مباشر"
              imageSrc="/illustrations/trophy.jpg"
              imageAlt="الحلبة"
              accentColor="gold"
              onClick={() => {}}
            />
          </div>
        </section>

        {/* 2-Column Stat Cards */}
        <section className="space-y-2">
          <span className="text-xs font-bold text-[#8FA3A0] block">5.8 Stat Cards</span>
          <div className="grid grid-cols-2 gap-3.5">
            <StatCard
              label="مراجعة الأخطاء"
              value="6 عناصر"
              imageSrc="/illustrations/pencil.jpg"
              imageAlt="مراجعة الأخطاء"
              onClick={() => {}}
            />
            <StatCard
              label="إجمالي وقت التعلم"
              value="2h 42m"
              imageSrc="/illustrations/clock.jpg"
              imageAlt="وقت التعلم"
            />
          </div>
        </section>

        {/* Buttons & Chips */}
        <section className="space-y-3 rounded-2xl border border-[#1D3139] bg-[#111E24] p-5 shadow-card">
          <span className="text-xs font-bold text-[#8FA3A0] block">5.4 & 5.10 Buttons & Chips</span>
          
          <div className="space-y-3">
            <button
              type="button"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0E9A78_0%,#14B58C_100%)] px-6 font-bold text-white shadow-[0_0_24px_rgba(20,181,140,0.35)] transition-all hover:shadow-[0_0_32px_rgba(20,181,140,0.5)] active:scale-[0.98]"
            >
              <span>زر رئيسي متوهج (Primary Glow Button)</span>
              <ChevronLeft className="h-5 w-5 rtl:block ltr:hidden" />
              <ArrowRight className="h-5 w-5 ltr:block rtl:hidden" />
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#2DD4A8]/30 bg-[#2DD4A8]/10 px-3 py-1 text-xs font-bold text-[#2DD4A8]">
                <Check className="h-3.5 w-3.5" /> ناجح / مكتمل
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#F5B942]/30 bg-[#F5B942]/10 px-3 py-1 text-xs font-bold text-[#F5B942]">
                🪙 150 نقطة
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-3 py-1 text-xs font-bold text-[#3B82F6]">
                ℹ️ معلومات
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-1 text-xs font-bold text-[#F87171]">
                ✕ خطأ
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
