import { ChevronLeft } from "lucide-react";

export interface FeatureTileProps {
  id?: string | undefined;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  accentColor?: ("blue" | "purple" | "emerald" | "gold") | undefined;
  badgeText?: string | undefined;
  onClick: () => void | Promise<void>;
}

export function FeatureTile({
  id,
  title,
  description,
  imageSrc,
  imageAlt,
  accentColor = "blue",
  badgeText,
  onClick,
}: FeatureTileProps) {
  const borderColors = {
    blue: "border-[#1D3139] hover:border-[#3B82F6]/50",
    purple: "border-[#1D3139] hover:border-[#7C5CFF]/50",
    emerald: "border-[#1D3139] hover:border-[#2DD4A8]/50",
    gold: "border-[#1D3139] hover:border-[#F5B942]/50",
  };

  return (
    <div
      id={id}
      onClick={onClick}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[24px] border bg-[#111E24] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.45)] active:scale-[0.98] cursor-pointer text-start ${borderColors[accentColor]}`}
    >
      {badgeText && (
        <span className="absolute left-3 top-3 rounded-full bg-[#F87171] px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
          {badgeText}
        </span>
      )}

      {/* Top 3D Icon & Title */}
      <div className="space-y-3">
        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-[#1D3139] bg-[#162730] p-1.5 shadow-md">
          <img
            src={imageSrc}
            alt={imageAlt}
            className="h-full w-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        <div>
          <h4 className="font-display text-base sm:text-lg font-bold text-white transition-colors group-hover:text-[#2DD4A8]">
            {title}
          </h4>
          <p className="mt-1 text-xs text-[#8FA3A0] leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>
      </div>

      {/* Bottom Small Round Emerald Arrow Button */}
      <div className="mt-5 flex justify-end">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14B58C] text-white shadow-[0_0_12px_rgba(20,181,140,0.35)] transition-transform duration-200 group-hover:scale-110 group-hover:shadow-[0_0_18px_rgba(20,181,140,0.6)]">
          <ChevronLeft className="h-5 w-5 rtl:rotate-0 ltr:rotate-180" />
        </div>
      </div>
    </div>
  );
}
