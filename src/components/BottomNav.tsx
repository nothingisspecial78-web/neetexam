import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Layers, Swords, Users, FileText } from "lucide-react";

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
      icon: BookOpen,
      badge: 0,
      active: currentPath === "/app",
    },
    {
      to: "/app/units",
      label: "الوحدات",
      icon: Layers,
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
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-card/95 backdrop-blur-md px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex min-h-[50px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 transition-all ${
                item.active
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    item.active
                      ? "bg-primary/15 text-primary scale-110 shadow-xs"
                      : "bg-transparent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {item.badge > 0 && (
                  <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-black text-slate-900 shadow-xs animate-pulse">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span className="mt-1 text-[11px] leading-none tracking-tight">
                {item.label}
              </span>
              {item.active && (
                <span className="absolute bottom-0.5 h-1 w-5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
