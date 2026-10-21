import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, BookOpen, Layers, Swords, Users, FileText } from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import { DeleteAccount } from "./DeleteAccount";
import { usePresence } from "@/lib/presence";

export function AppHeader({ title, back }: { title?: string; back?: boolean }) {
  usePresence();
  const router = useRouterState();
  const currentPath = router.location.pathname;

  const desktopLinks = [
    { to: "/app", label: "الرئيسية", icon: BookOpen, active: currentPath === "/app" },
    { to: "/app/units", label: "الوحدات", icon: Layers, active: currentPath.startsWith("/app/units") },
    { to: "/app/arena", label: "الساحة", icon: Swords, active: currentPath.startsWith("/app/arena") },
    { to: "/app/friends", label: "الأصدقاء", icon: Users, active: currentPath.startsWith("/app/friends") },
    { to: "/app/questions", label: "أسئلتي", icon: FileText, active: currentPath.startsWith("/app/questions") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#1D3139] bg-[#0A1418]/90 backdrop-blur-md px-4 sm:px-6 py-3 text-white shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {back ? (
            <Link
              to="/app"
              aria-label="رجوع"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1D3139] bg-[#162730] text-[#D6E2DD] hover:bg-[#111E24] hover:text-white transition-all active:scale-95"
            >
              <ChevronRight className="h-5 w-5 ltr:rotate-180" />
            </Link>
          ) : (
            <Link
              to="/app"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1D3139] bg-[#162730] hover:border-[#14B58C]/50 transition-all shadow-sm"
            >
              <img src="/app-icon.png" alt="مِدْرَاس" className="h-7 w-7 rounded-lg object-cover" />
            </Link>
          )}

          <div className="flex items-center gap-2">
            <Link to="/app" className="font-display text-xl font-extrabold tracking-tight text-[#2DD4A8] hover:text-[#5EEAD4] transition-colors">
              مِدْرَاس
            </Link>
            {title && title !== "مِدْرَاس" && (
              <>
                <span className="text-[#1D3139] text-sm">/</span>
                <span className="text-sm font-semibold text-[#D6E2DD] truncate max-w-[180px] sm:max-w-xs">
                  {title}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5">
          {desktopLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  item.active
                    ? "border border-[#2DD4A8]/40 bg-[#14B58C]/15 text-[#2DD4A8] shadow-[0_0_16px_rgba(20,181,140,0.25)]"
                    : "text-[#8FA3A0] hover:text-white hover:bg-[#162730]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <DeleteAccount variant="headerButton" />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
