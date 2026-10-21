import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Swords, Users, FileText } from "lucide-react";

interface BottomNavProps {
  incomingFriendsCount?: number;
  arenaInvitesCount?: number;
}

export function BottomNav({ incomingFriendsCount = 0, arenaInvitesCount = 0 }: BottomNavProps) {
  const router = useRouterState();
  const currentPath = router.location.pathname;

  const navItems = [
    {
      to: "/app",
      label: "الرئيسية",
      icon: Home,
      badge: 0,
      active: currentPath === "/app",
    },
    {
      to: "/app/units",
      label: "الوحدات",
      icon: BookOpen,
      badge: 0,
      active: currentPath.startsWith("/app/units"),
    },
    {
      to: "/app/arena",
      label: "الساحة",
      icon: Swords,
      badge: arenaInvitesCount,
      active: currentPath.startsWith("/app/arena"),
    },
    {
      to: "/app/friends",
      label: "الأصدقاء",
      icon: Users,
      badge: incomingFriendsCount,
      active: currentPath.startsWith("/app/friends"),
    },
    {
      to: "/app/questions",
      label: "أسئلتي",
      icon: FileText,
      badge: 0,
      active: currentPath.startsWith("/app/questions"),
    },
  ];

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-[#1D3139] bg-[#111E24]/95 backdrop-blur-lg px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.5)] md:hidden rounded-t-[24px]"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex min-h-[50px] min-w-[56px] flex-col items-center justify-center rounded-2xl px-2 py-1 transition-all ${
                item.active
                  ? "text-[#2DD4A8] font-bold"
                  : "text-[#8FA3A0] hover:text-[#D6E2DD]"
              }`}
            >
              <div className="relative">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    item.active
                      ? "bg-[#14B58C]/20 text-[#2DD4A8] scale-110 shadow-[0_0_16px_rgba(20,181,140,0.4)]"
                      : "bg-transparent"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={item.active ? 2.5 : 2} />
                </span>
                {item.badge > 0 && (
                  <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F87171] px-1 text-[10px] font-black text-white shadow-xs animate-pulse">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span className="mt-1 text-[11px] leading-none tracking-tight">
                {item.label}
              </span>
              {item.active && (
                <span className="absolute bottom-0 h-1 w-5 rounded-full bg-[#2DD4A8] shadow-[0_0_8px_rgba(45,212,168,0.7)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
