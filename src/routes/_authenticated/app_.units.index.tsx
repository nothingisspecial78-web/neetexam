import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Shuffle, Pencil, Merge, Split, ClipboardCheck, Upload, BookOpen, Circle, Sparkles, Send, FolderPlus, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { unitsOptions, pickRandomUnit, type UnitStat } from "@/lib/units";
import { myQuestionsOptions } from "@/lib/my-questions";
import { publishQuestions } from "@/lib/questions.functions";
import { isReady } from "@/lib/question-rules";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreateUnitDialog } from "@/components/CreateUnitDialog";
import { MistakesBank } from "@/components/MistakesBank";
import { AttendedComprehensiveTest } from "@/components/AttendedComprehensiveTest";

export const Route = createFileRoute("/_authenticated/app_/units/")({
  head: () => ({
    meta: [
      { title: "الوحدات — مِدْرَاس" },
      { name: "description", content: "تدرّب على وحداتك بأي ترتيب." },
      { property: "og:title", content: "الوحدات — مِدْرَاس" },
      { property: "og:description", content: "تدرّب على وحداتك بأي ترتيب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(unitsOptions(context.user.id)),
  errorComponent: () => <p role="alert">تعذّر تحميل الوحدات، حاول مجددًا.</p>,
  notFoundComponent: () => <p>الوحدة غير موجودة.</p>,
  component: Units,
});

const STATUS = { new: "جديدة", progress: "قيد التقدّم", done: "مكتملة" } as const;
const STATUS_STYLE = {
  new:      "bg-muted text-muted-foreground",
  progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  done:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
} as const;

type Action = { kind: "rename" | "merge" | "split"; unit: UnitStat } | null;

function Units() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(unitsOptions(user.id));
  const { data: myQuestions } = useQuery(myQuestionsOptions(user.id));
  const publishFn = useServerFn(publishQuestions);
  const [publishing, setPublishing] = useState(false);
  const [section, setSection] = useState<"units" | "mistakes" | "comprehensive">("units");
  const [createOpen, setCreateOpen] = useState(false);

  const drafts = (myQuestions ?? []).filter((q) => q.status === "draft");
  const readyDrafts = drafts.filter(isReady);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["dashboard", user.id] });
    return qc.invalidateQueries({ queryKey: ["units", user.id] });
  };

  async function publishAllDrafts() {
    if (publishing || !readyDrafts.length) return;
    setPublishing(true);
    try {
      const { ids } = await publishFn({ data: { ids: readyDrafts.map((q) => q.id) } });
      toast.success(`تم نشر ${ids.length} سؤالًا وتجميعها في وحدات دراسية بنجاح! 🎉`);
      await refresh();
      void qc.invalidateQueries({ queryKey: ["my-questions", user.id] });
    } catch {
      toast.error("تعذّر نشر الأسئلة، حاول مجددًا");
    } finally {
      setPublishing(false);
    }
  }

  const [action, setAction] = useState<Action>(null);
  const mine = data.stats.filter((s) => !s.owner_name);
  const close = () => setAction(null);
  const ownQs = (id: string) => data.questions.filter((q) => q.unit_id === id && !q.from_name);
  const shared = (id: string) => data.questions.filter((q) => q.unit_id === id && q.from_name).length;
  const done = () => { setAction(null); refresh(); };

  function random() {
    const u = pickRandomUnit(data.stats);
    if (u) navigate({ to: "/app/units/$unitId", params: { unitId: u.id } });
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader title="الوحدات" back />
      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Section Tabs Switcher */}
        <div className="mb-6 flex items-center gap-2 p-1.5 bg-muted/60 rounded-2xl border">
          <button
            type="button"
            id="tab-units-btn"
            onClick={() => setSection("units")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              section === "units"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4 text-primary" />
            <span>الوحدات الدراسية</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
              {data.stats.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-mistakes-btn"
            onClick={() => setSection("mistakes")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              section === "mistakes"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span>بنك الأخطاء</span>
          </button>

          <button
            type="button"
            id="tab-comprehensive-btn"
            onClick={() => setSection("comprehensive")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              section === "comprehensive"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardCheck className="h-4 w-4 text-emerald-500" />
            <span>اختبار المراجعة (25)</span>
          </button>
        </div>

        {/* SECTION 1: UNITS */}
        {section === "units" && (
          <>
            {!data.stats.length ? (
              drafts.length > 0 ? (
                /* Empty units state but drafts waiting to be published */
                <div className="animate-scale-in flex flex-col items-center rounded-2xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 p-8 sm:p-10 text-center shadow-card">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Sparkles className="h-10 w-10 animate-pulse" strokeWidth={1.5} />
                  </div>
                  <h2 className="font-display text-xl font-bold text-foreground">
                    لديك {drafts.length} سؤالاً تم رفعها وبانتظار النشر!
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    لقد قمت برفع الأسئلة ومراجعتها بنجاح. انقر على الزر أدناه لتجميعها تلقائيًا في وحدات دراسية حسب موضوعاتها والبدء بالتدرّب الآن.
                  </p>
                  <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
                    <Button
                      id="publish-drafts-units-btn"
                      disabled={publishing || !readyDrafts.length}
                      className="w-full h-12 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md transition-transform active:scale-[0.98]"
                      onClick={publishAllDrafts}
                    >
                      <Send className="h-4 w-4 rtl:rotate-180" />
                      {publishing ? "جارٍ إنشاء الوحدات…" : `انشر ${readyDrafts.length} سؤالاً الآن في الوحدات`}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-12 rounded-xl font-semibold"
                      onClick={() => navigate({ to: "/app/questions" })}
                    >
                      مراجعة الأسئلة ({drafts.length})
                    </Button>
                  </div>
                </div>
              ) : (
                /* Regular empty state */
                <div className="animate-scale-in flex flex-col items-center rounded-2xl border bg-card p-10 text-center shadow-card">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-400 dark:bg-emerald-900/30">
                    <BookOpen className="h-10 w-10" strokeWidth={1.5} />
                  </div>
                  <h2 className="font-display text-xl font-bold">لا توجد وحدات بعد</h2>
                  <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                    يمكنك إضافة وحدة يدويًا أو رفع ملف أسئلة md لتجميعها وتصنيفها تلقائيًا.
                  </p>
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm">
                    <Button
                      id="units-add-btn"
                      className="w-full sm:w-auto h-12 rounded-xl px-5 font-semibold gap-2"
                      onClick={() => setCreateOpen(true)}
                    >
                      <FolderPlus className="h-4 w-4" />
                      إضافة وحدة جديدة
                    </Button>
                    <Button
                      id="units-upload-btn"
                      variant="outline"
                      className="w-full sm:w-auto h-12 rounded-xl px-5 font-semibold gap-2"
                      onClick={() => navigate({ to: "/app/upload" })}
                    >
                      <Upload className="h-4 w-4" />
                      ارفع أسئلتك
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <>
                {/* If units exist AND there are unpublished drafts */}
                {readyDrafts.length > 0 && (
                  <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>لديك <strong>{readyDrafts.length}</strong> سؤالاً جاهزاً لم يُنشر بعد في الوحدات.</span>
                    </div>
                    <Button
                      size="sm"
                      disabled={publishing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shrink-0 gap-1.5 self-start sm:self-auto"
                      onClick={publishAllDrafts}
                    >
                      <Send className="h-3.5 w-3.5 rtl:rotate-180" />
                      {publishing ? "جارٍ النشر…" : `انشر الآن (${readyDrafts.length})`}
                    </Button>
                  </div>
                )}

                {/* Toolbar */}
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    id="units-add-unit-top-btn"
                    className="h-11 rounded-xl font-semibold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                    onClick={() => setCreateOpen(true)}
                  >
                    <FolderPlus className="h-4 w-4" />
                    إضافة وحدة جديدة
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      id="units-random-btn"
                      variant="outline"
                      className="h-11 rounded-xl font-semibold gap-1.5"
                      onClick={random}
                    >
                      <Shuffle className="h-4 w-4" />
                      وحدة عشوائية
                    </Button>
                    <Button
                      id="units-exam-btn"
                      variant="outline"
                      className="h-11 rounded-xl font-semibold gap-1.5"
                      onClick={() => navigate({ to: "/app/exam" })}
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      اختبار
                    </Button>
                  </div>
                </div>

                {/* Units grid */}
                <div className="grid gap-3">
                  {data.stats.map((u, idx) => (
                    <div
                      key={u.id}
                      className={`animate-fade-in-up stagger-${Math.min(idx + 1, 4)} group rounded-2xl border bg-card shadow-card transition-all duration-150 hover:shadow-soft`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Clickable area */}
                          <button
                            className="flex-1 text-start"
                            onClick={() => navigate({ to: "/app/units/$unitId", params: { unitId: u.id } })}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-display text-lg font-semibold group-hover:text-primary transition-colors">
                                {u.name}
                              </h2>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[u.status]}`}>
                                {STATUS[u.status]}
                              </span>
                            </div>
                            {u.owner_name && (
                              <p className="mt-0.5 text-xs font-medium text-primary">من {u.owner_name}</p>
                            )}
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {u.total} سؤال · التقدّم {u.progress}%
                              {u.best !== null ? ` · أفضل نتيجة ${u.best}%` : ""}
                            </p>
                            {!u.owner_name && shared(u.id) > 0 && (
                              <p className="mt-0.5 text-xs text-primary">
                                منها {shared(u.id)} من أصدقائك
                              </p>
                            )}
                          </button>

                          {/* Action icons & Upload button */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!u.owner_name && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg text-xs gap-1 font-medium text-primary border-primary/30 hover:bg-primary/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate({ to: "/app/upload", search: { unitId: u.id } as any });
                                }}
                              >
                                <Upload className="h-3.5 w-3.5" />
                                رفع أسئلة
                              </Button>
                            )}

                            {!u.owner_name && (
                              <div className="flex shrink-0 gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="إعادة التسمية"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => setAction({ kind: "rename", unit: u })}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="دمج"
                                  className="h-8 w-8 rounded-lg"
                                  disabled={mine.length < 2}
                                  onClick={() => setAction({ kind: "merge", unit: u })}
                                >
                                  <Merge className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="تقسيم"
                                  className="h-8 w-8 rounded-lg"
                                  disabled={ownQs(u.id).length < 2}
                                  onClick={() => setAction({ kind: "split", unit: u })}
                                >
                                  <Split className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3">
                          <Progress
                            value={u.progress}
                            className="h-2 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* SECTION 2: MISTAKES BANK */}
        {section === "mistakes" && (
          <div className="animate-fade-in">
            <MistakesBank userId={user.id} />
          </div>
        )}

        {/* SECTION 3: COMPREHENSIVE 25-QUESTION TEST */}
        {section === "comprehensive" && (
          <div className="animate-fade-in">
            <AttendedComprehensiveTest userId={user.id} />
          </div>
        )}

        {/* Create Unit Dialog */}
        <CreateUnitDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          userId={user.id}
          onCreated={() => {
            void refresh();
          }}
        />

        {action?.kind === "rename" && <RenameDialog unit={action.unit} onClose={close} onDone={done} />}
        {action?.kind === "merge" && (
          <MergeDialog
            unit={action.unit}
            others={mine.filter((s) => s.id !== action.unit.id)}
            onClose={close}
            onDone={done}
          />
        )}
        {action?.kind === "split" && (
          <SplitDialog
            unit={action.unit}
            questions={ownQs(action.unit.id)}
            onClose={close}
            onDone={done}
          />
        )}
      </main>
    </div>
  );
}

type DialogProps = { unit: UnitStat; onClose: () => void; onDone: () => void };

function RenameDialog({ unit, onClose, onDone }: DialogProps) {
  const [name, setName] = useState(unit.name);
  const [busy, setBusy] = useState(false);
  async function save() {
    const n = name.trim().slice(0, 80);
    if (!n) return void toast.error("اكتب اسمًا");
    if (n === unit.name) return onClose();
    setBusy(true);
    const { error } = await supabase.from("units").update({ name: n }).eq("id", unit.id);
    setBusy(false);
    if (error) return void toast.error("تعذّر الحفظ");
    onDone();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>إعادة تسمية الوحدة</DialogTitle></DialogHeader>
        <Input
          className="h-12 rounded-xl"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <DialogFooter>
          <Button className="rounded-xl" disabled={busy} onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog({ unit, others, onClose, onDone }: DialogProps & { others: UnitStat[] }) {
  const [busy, setBusy] = useState(false);
  async function mergeInto(target: UnitStat) {
    setBusy(true);
    const { error } = await supabase.from("questions").update({ unit_id: target.id }).eq("unit_id", unit.id);
    if (!error) await supabase.from("units").delete().eq("id", unit.id);
    setBusy(false);
    if (error) return void toast.error("تعذّر الدمج");
    toast.success(`تم دمج «${unit.name}» في «${target.name}»`);
    onDone();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>ادمج «{unit.name}» في:</DialogTitle></DialogHeader>
        <div className="grid gap-2">
          {others.map((o) => (
            <Button
              key={o.id}
              variant="outline"
              className="h-12 justify-between rounded-xl"
              disabled={busy}
              onClick={() => mergeInto(o)}
            >
              <span>{o.name}</span>
              <span className="text-xs text-muted-foreground">{o.total} سؤال</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SplitDialog({ unit, questions, onClose, onDone }: DialogProps & { questions: { id: string; question_text: string }[] }) {
  const [name, setName] = useState(`${unit.name} ٢`);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = name.trim().slice(0, 80);
    if (!n) return void toast.error("اكتب اسم الوحدة الجديدة");
    if (!sel.length || sel.length === questions.length) return void toast.error("اختر بعض الأسئلة لا كلها");
    setBusy(true);
    const { data: nu, error } = await supabase
      .from("units")
      .insert({ name: n, topic_area: `${unit.name} · ${crypto.randomUUID().slice(0, 8)}` })
      .select("id")
      .single();
    const moved = nu && await supabase.from("questions").update({ unit_id: nu.id }).in("id", sel);
    setBusy(false);
    if (error || !moved || moved.error) return void toast.error("تعذّر التقسيم");
    toast.success("تم التقسيم");
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>تقسيم «{unit.name}»</DialogTitle></DialogHeader>
        <label className="text-sm font-medium">اسم الوحدة الجديدة</label>
        <Input className="h-12 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
        <p className="text-sm text-muted-foreground">اختر الأسئلة التي تنتقل إليها ({sel.length})</p>
        <div className="grid gap-2 max-h-64 overflow-y-auto">
          {questions.map((q) => (
            <label
              key={q.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm hover:bg-muted transition-colors"
            >
              <Checkbox
                className="mt-0.5"
                checked={sel.includes(q.id)}
                onCheckedChange={(c) => setSel(c ? [...sel, q.id] : sel.filter((x) => x !== q.id))}
              />
              <span className="leading-relaxed">{q.question_text}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button className="rounded-xl" disabled={busy} onClick={save}>قسّم</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
