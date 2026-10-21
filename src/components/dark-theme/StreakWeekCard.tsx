import { Check } from "lucide-react";

export type StreakDay = {
  dayNum: number;
  label: string;
  completed: boolean;
  isToday?: boolean;
};

export interface StreakWeekCardProps {
  streakDays?: number | undefined;
  days?: StreakDay[] | undefined;
}

export function StreakWeekCard({ streakDays = 0, days }: StreakWeekCardProps) {
  // If days are not passed from parent, generate the current Arabic week (Saturday -> Friday)
  const displayDays = days ?? (() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
    const daysSinceSaturday = (dayOfWeek + 1) % 7;
    const arabicLabels = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - daysSinceSaturday + i);
      const isToday = d.toDateString() === now.toDateString();
      return {
        dayNum: d.getDate(),
        label: arabicLabels[i] || "س",
        completed: false,
        isToday,
      };
    });
  })();

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[#1D3139] bg-[#111E24] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
        {/* Streak Flame Side */}
        <div className="flex items-center gap-3.5 w-full sm:w-auto justify-start">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#1D3139] bg-[#162730] p-1 shadow-md">
            <img
              src="/illustrations/flame.jpg"
              alt="لهب الأيام المتتالية"
              className="h-full w-full object-cover rounded-xl"
              loading="lazy"
            />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#8FA3A0] block">أيام متتالية</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#F5B942]">
                {streakDays}
              </span>
              <span className="text-xs font-medium text-[#D6E2DD]">
                {streakDays > 0 ? "يوم حماسي 🔥" : "ابدأ سلسلتك اليوم! ⚡"}
              </span>
            </div>
          </div>
        </div>

        {/* 7 Days Strip (RTL Right to Left: Saturday to Friday) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto overflow-x-auto py-1">
          {displayDays.map((d, idx) => {
            let circleClass = "border border-[#1D3139] bg-[#162730] text-[#8FA3A0]";

            if (d.completed) {
              circleClass =
                "bg-[#14B58C] text-white border-transparent shadow-[0_0_16px_rgba(20,181,140,0.45)]";
            } else if (d.isToday) {
              circleClass =
                "border-2 border-[#2DD4A8] bg-[#162730] text-[#2DD4A8] shadow-[0_0_12px_rgba(45,212,168,0.3)]";
            }

            return (
              <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0 min-w-9">
                {/* Day of month number above circle */}
                <span className="text-[11px] font-mono font-medium text-[#8FA3A0]">{d.dayNum}</span>
                {/* Circle: checkmark if completed, pulsing emerald ring if today, or empty dark circle */}
                <div
                  className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs font-bold transition-all ${circleClass}`}
                >
                  {d.completed ? (
                    <Check className="h-4 w-4 stroke-[2.5]" />
                  ) : d.isToday ? (
                    <div className="h-2 w-2 rounded-full bg-[#2DD4A8] animate-pulse" />
                  ) : null}
                </div>
                {/* Arabic weekday letter below circle */}
                <span className="text-[11px] font-semibold text-[#D6E2DD]">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
