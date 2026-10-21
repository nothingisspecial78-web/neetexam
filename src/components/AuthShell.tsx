import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

// Shared frame for auth screens:
// - Full emerald hero header with brand logo + decorative dots
// - Elevated card overlapping the hero
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-hero relative overflow-hidden px-6 pb-24 pt-12 text-center text-white">
        <div className="pattern-arabesque absolute inset-0 opacity-10" aria-hidden />
        <div className="relative">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-display text-3xl font-bold hover:opacity-90 transition-opacity"
            aria-label="مِدْرَاس — الصفحة الرئيسية"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <BookOpen className="h-5 w-5" />
            </span>
            مِدْرَاس
          </Link>
          <h1 className="mt-5 font-display text-2xl font-bold">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-white/75">{subtitle}</p>
          )}
        </div>
      </header>

      {/* Elevated card */}
      <main className="relative z-10 mx-auto -mt-12 max-w-md px-4 pb-16">
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          {children}
        </div>
      </main>
    </div>
  );
}
