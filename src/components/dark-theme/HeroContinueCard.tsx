import { ChevronLeft, Sparkles } from "lucide-react";

export interface HeroContinueCardProps {
  unitName?: string | undefined;
  progressPercent?: number | undefined;
  levelText?: string | undefined;
  onContinue: () => void | Promise<void>;
}

export function HeroContinueCard({
  unitName = "العصر الجاهلي وصناع المعلقات",
  progressPercent = 0,
  levelText = "مستوى مبتدئ",
  onContinue,
}: HeroContinueCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[#1D3139] bg-[linear-gradient(160deg,#0F2A2E_0%,#0A1A1F_100%)] p-5 sm:p-6 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-[#14B58C]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-[#0E9A78]/10 blur-3xl" />

      <div className="relative z-10 space-y-4">
        {/* Top Row: Illustration on Left (in RTL), Text on Right */}
        <div className="flex items-center justify-between gap-3 sm:gap-5">
          {/* Right Content in RTL (Text & Progress) */}
          <div className="flex-1 space-y-2.5 text-start min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2DD4A8]/30 bg-[#2DD4A8]/10 px-2.5 py-0.5 text-xs font-bold text-[#2DD4A8]">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate">{levelText}</span>
              </span>
            </div>

            <div>
              <h2 className="font-display text-lg sm:text-2xl font-bold text-white tracking-wide leading-tight">
                تابع رحلتك التعليمية
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-medium text-[#8FA3A0] truncate">
                اسم الدرس: <span className="text-[#D6E2DD] font-semibold">{unitName}</span>
              </p>
            </div>

            {/* Progress bar with percentage */}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#8FA3A0]">نسبة الإنجاز</span>
                <span className="text-[#2DD4A8] font-mono">{progressPercent}٪</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#162730]">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-[#14B58C] to-[#2DD4A8] transition-all duration-500 shadow-[0_0_12px_rgba(45,212,168,0.5)]"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Left Illustration in RTL */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="relative h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40">
              <img
                src="/illustrations/hero_student.jpg"
                alt="طالب يدرس ومصباح فكرة يضيء"
                className="h-full w-full object-cover rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.5)] border border-[#1D3139]/80"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
            </div>
          </div>
        </div>

        {/* Wide Gradient Button spanning bottom */}
        <button
          type="button"
          onClick={onContinue}
          className="group relative flex h-12 sm:h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0E9A78_0%,#14B58C_100%)] px-6 text-sm sm:text-base font-bold text-white shadow-[0_0_24px_rgba(20,181,140,0.35)] transition-all duration-200 hover:shadow-[0_0_32px_rgba(20,181,140,0.55)] active:scale-[0.98] cursor-pointer"
        >
          <span>متابعة التدريب</span>
          <ChevronLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1 rtl:rotate-0 ltr:rotate-180" />
        </button>
      </div>
    </div>
  );
}
