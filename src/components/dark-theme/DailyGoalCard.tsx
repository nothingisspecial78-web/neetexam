import { Check } from "lucide-react";

export interface DailyGoalCardProps {
  currentCount?: number | undefined;
  targetCount?: number | undefined;
}

export function DailyGoalCard({ currentCount = 0, targetCount = 20 }: DailyGoalCardProps) {
  const isGoalAchieved = currentCount >= targetCount;
  const percentage = Math.min(100, Math.round((currentCount / targetCount) * 100));

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[#1D3139] bg-[linear-gradient(135deg,#0B4A3A_0%,#0A2B2B_100%)] p-5 sm:p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      {/* Background ambient light */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#14B58C]/15 blur-2xl" />

      <div className="relative z-10 flex items-center justify-between gap-4">
        {/* Left Side: 3D Trophy Illustration */}
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-2xl border border-[#2DD4A8]/30 bg-[#0A1A1F] p-1.5 shadow-lg">
            <img
              src="/illustrations/trophy.jpg"
              alt="كأس إنجاز الهدف اليومي"
              className="h-full w-full object-cover rounded-xl"
              loading="lazy"
            />
          </div>

          <div className="space-y-1 text-start">
            <h3 className="font-display text-lg sm:text-xl font-bold text-white">هدفك اليوم</h3>
            <p className="text-xs sm:text-sm font-semibold text-[#2DD4A8]">
              {isGoalAchieved ? "تم تحقيق الهدف بنجاح! 🏆" : `${currentCount} من ${targetCount} أسئلة مكتملة`}
            </p>
            <p className="text-[11px] text-[#8FA3A0]">
              {isGoalAchieved ? "أداء ممتاز! حافظ على استمرارية التدريب" : "أجب عن المزيد لإكمال حلقة اليوم"}
            </p>
          </div>
        </div>

        {/* Right Side: Circular Goal Check/Ring */}
        <div className="shrink-0">
          <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-3 border-[#2DD4A8] bg-[#0A1A1F] shadow-[0_0_20px_rgba(45,212,168,0.4)]">
            {isGoalAchieved ? (
              <Check className="h-7 w-7 text-[#2DD4A8] stroke-[3]" />
            ) : (
              <span className="font-mono text-sm font-extrabold text-[#2DD4A8]">{percentage}%</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
