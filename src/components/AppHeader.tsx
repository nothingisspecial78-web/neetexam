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
    <header className="bg-hero sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3 text-white shadow-soft">
      <div className="flex items-center gap-3 min-w-0">
        {back ? (
          <Link
            to="/app"
            aria-label="رجوع"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95"
          >
            <ChevronRight className="h-5 w-5 ltr:rotate-180" />
          </Link>
        ) : (
          <Link
            to="/app"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all"
          >
            <img src="/app-icon.png" alt="مِدْرَاس" className="h-7 w-7 rounded-lg object-cover shadow-xs" />
          </Link>
        )}
        <div className="flex items-center gap-2">
          <Link to="/app" className="font-display text-xl font-bold tracking-tight">
            مِدْرَاس
          </Link>
          {title && title !== "مِدْرَاس" && (
            <>
              <span className="text-white/40 text-sm">/</span>
              <span className="text-sm font-semibold text-white/90 truncate max-w-[180px] sm:max-w-xs">
                {title}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Desktop Navigation Links */}
      <nav className="hidden md:flex items-center gap-1">
        {desktopLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? "bg-white/20 text-white font-bold shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/10"
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
    </header>
  );
}
