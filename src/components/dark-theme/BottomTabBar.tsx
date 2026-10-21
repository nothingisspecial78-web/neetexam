import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Swords, Users, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteAccount } from "@/components/DeleteAccount";

export function BottomTabBar() {
  const routerState = useRouterState();
  const path = routerState.location.pathname;
  const [moreOpen, setMoreOpen] = useState(false);

  // Hide bottom tab bar during active quiz/exam or arena match
  const isMatchOrPractice =
    path.startsWith("/app/units/") && path !== "/app/units";

  if (isMatchOrPractice) return null;

  const tabs = [
    {
      to: "/app",
      label: "الرئيسية",
      icon: Home,
      isActive: path === "/app",
    },
    {
      to: "/app/units",
      label: "الوحدات",
      icon: BookOpen,
      isActive: path.startsWith("/app/units"),
    },
    {
      to: "/app/arena",
      label: "الساحة",
      icon: Swords,
      isActive: path.startsWith("/app/arena"),
    },
    {
      to: "/app/friends",
      label: "الأصدقاء",
      icon: Users,
      isActive: path.startsWith("/app/friends"),
    },
  ];

  return (
    <>
      <nav
        aria-label="شريط التنقل السفلي"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-[#1D3139] bg-[#111E24]/95 backdrop-blur-lg shadow-[0_-8px_24px_rgba(0,0,0,0.4)]"
      >
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`relative flex flex-col items-center justify-center gap-1 py-1 px-3 transition-colors ${
                  tab.isActive ? "text-[#2DD4A8]" : "text-[#8FA3A0] hover:text-[#D6E2DD]"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  {tab.isActive && (
                    <span className="absolute -inset-1.5 rounded-full bg-[#14B58C]/20 blur-sm" />
                  )}
                  <Icon className="relative z-10 h-5 w-5" strokeWidth={tab.isActive ? 2.5 : 2} />
                </div>
                <span className="text-[11px] font-bold">{tab.label}</span>
              </Link>
            );
          })}

          {/* More Tab */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`relative flex flex-col items-center justify-center gap-1 py-1 px-3 transition-colors cursor-pointer text-[#8FA3A0] hover:text-[#D6E2DD]`}
          >
            <div className="relative flex items-center justify-center">
              <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold">المزيد</span>
          </button>
        </div>
      </nav>

      {/* More / Settings Dialog */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-[#1D3139] bg-[#111E24] p-6 text-foreground text-start">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">إعدادات الحساب والمزيد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-[#1D3139] bg-[#162730] p-4 space-y-2">
              <span className="text-xs font-semibold text-[#8FA3A0] block">إدارة البيانات</span>
              <p className="text-xs text-[#D6E2DD] leading-relaxed">
                يمكنك مراجعة نشاطك أو حذف بيانات حسابك نهائياً من مِدْرَاس.
              </p>
            </div>
            <DeleteAccount />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
