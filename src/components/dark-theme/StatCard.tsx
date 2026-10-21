export interface StatCardProps {
  id?: string | undefined;
  label: string;
  value: string | number;
  imageSrc: string;
  imageAlt: string;
  onClick?: (() => void) | undefined;
}

export function StatCard({ id, label, value, imageSrc, imageAlt, onClick }: StatCardProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`flex items-center gap-4 rounded-[24px] border border-[#1D3139] bg-[#111E24] p-4 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all duration-200 ${
        onClick
          ? "hover:border-[#2DD4A8]/40 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer"
          : ""
      }`}
    >
      <div className="relative h-13 w-13 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-2xl border border-[#1D3139] bg-[#162730] p-1 shadow-sm">
        <img src={imageSrc} alt={imageAlt} className="h-full w-full object-cover rounded-xl" loading="lazy" />
      </div>

      <div className="text-start space-y-0.5">
        <span className="text-xs font-medium text-[#8FA3A0] block">{label}</span>
        <span className="font-display text-xl sm:text-2xl font-extrabold text-white block">
          {value}
        </span>
      </div>
    </div>
  );
}
