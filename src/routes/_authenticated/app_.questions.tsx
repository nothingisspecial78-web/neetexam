import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileQuestion, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { myQuestionsOptions } from "@/lib/my-questions";
import { AppHeader } from "@/components/AppHeader";
import { QuestionList } from "@/components/QuestionList";
import { Button } from "@/components/ui/button";
import type { QRow } from "@/components/QuestionCard";

export const Route = createFileRoute("/_authenticated/app_/questions")({
  head: () => ({
    meta: [
      { title: "بنك أسئلتي — مِدْرَاس" },
      { name: "description", content: "تصفّح أسئلتك المرفوعة، راجع تدقيق الذكاء الاصطناعي وانشرها." },
      { property: "og:title", content: "بنك أسئلتي — مِدْرَاس" },
      { property: "og:description", content: "تصفّح أسئلتك المرفوعة، راجع تدقيق الذكاء الاصطناعي وانشرها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myQuestionsOptions(context.user.id)),
  errorComponent: () => (
    <div className="py-12 text-center" role="alert">
      <p className="text-destructive font-semibold">تعذّر تحميل بنك الأسئلة، حاول مجددًا.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="py-12 text-center">
      <p className="text-muted-foreground">الصفحة المطلوبة غير موجودة.</p>
    </div>
  ),
  component: MyQuestions,
});

function MyQuestions() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const key = ["my-questions", user.id];
  const { data } = useSuspenseQuery(myQuestionsOptions(user.id));

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader title="بنك أسئلتي" back />

      <main className="mx-auto max-w-xl px-4 py-6 space-y-5">
        {/* Top Header Card */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">
              الأسئلة والمسودات ({data?.length ?? 0})
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              راجع الأسئلة التي قمت برفعها وتدقيقها تمهيدًا لنشرها في الوحدات.
            </p>
          </div>
          <Button asChild size="sm" className="rounded-xl gap-1.5 font-semibold shrink-0">
            <Link to="/app/upload">
              <Plus className="h-4 w-4" />
              <span>رفع ملف</span>
            </Link>
          </Button>
        </div>

        {data && (
          <QuestionList
            search
            rows={data}
            userId={user.id}
            setRows={(r: QRow[]) => qc.setQueryData(key, r)}
          />
        )}
      </main>
    </div>
  );
}
