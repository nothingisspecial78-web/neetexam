import { Check } from "lucide-react";

export interface StreakWeekCardProps {
  streakDays?: number | undefined;
}

export function StreakWeekCard({ streakDays = 2 }: StreakWeekCardProps) {
  // Generate 7 days of the current week (Arabic days)
  const days = [
    { dayNum: 14, label: "س", completed: true },
    { dayNum: 15, label: "ح", completed: true },
    { dayNum: 17, label: "ن", completed: true },
    { dayNum: 18, label: "ث", completed: true, isToday: true },
    { dayNum: 19, label: "ر", completed: false },
    { dayNum: 20, label: "خ", completed: false },
    { dayNum: 21, label: "ج", completed: false },
  ];

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
              <span className="text-xs font-medium text-[#D6E2DD]">يوم حماسي 🔥</span>
            </div>
          </div>
        </div>

        {/* 7 Days Strip (RTL Right to Left) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto overflow-x-auto py-1">
          {days.map((d, idx) => {
            let circleClass = "border border-[#1D3139] bg-[#162730] text-[#8FA3A0]";

            if (d.completed) {
              circleClass =
                "bg-[#14B58C] text-white border-transparent shadow-[0_0_16px_rgba(20,181,140,0.45)]";
            } else if (d.isToday) {
              circleClass =
                "border-2 border-[#2DD4A8] bg-[#162730] text-[#2DD4A8] shadow-[0_0_12px_rgba(45,212,168,0.3)]";
            }

            return (
              <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-mono font-medium text-[#8FA3A0]">{d.dayNum}</span>
                <div
                  className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs font-bold transition-all ${circleClass}`}
                >
                  {d.completed ? <Check className="h-4 w-4 stroke-[2.5]" /> : d.dayNum}
                </div>
                <span className="text-[11px] font-semibold text-[#D6E2DD]">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
