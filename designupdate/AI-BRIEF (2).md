# AI Brief: Read This First

You are helping me (ABE) build an app. This file explains my idea and how I want you to work. The other `.md` files in this folder are the detailed specification. Read this file first, then the rest in the order given below.

## 1. The Idea in One Paragraph

I am building a mobile-friendly web app (PWA) for students preparing for the **Arabic literature NEET-style exam**. The questions are **multiple-choice only**. There is no pre-made question bank: **the students create it themselves** by uploading their questions as txt, md or pdf files. An AI extracts and checks those questions, the app groups them into topic units, and students practise, take tests, share question banks with friends, and compete in live 1-minute duels to win credits.

## 2. Who Uses It

| Role | Description |
|---|---|
| **Student** | Anyone who signs up with an email and confirms it through Gmail. Uploads questions, practises, competes. |
| **Super Admin** | The one and only admin (set by the `SUPER_ADMIN_EMAIL` environment variable). Cannot be duplicated or promoted from the UI. Sees user logs, active users, and total question count. |

There are two separate interfaces: the Student App (`/app`) and the Admin Panel (`/admin`).

## 3. Core Ideas You Must Not Miss

1. **Email confirmation is mandatory.** After sign-up the student must open Gmail and click the confirmation link. Nothing works until then.
2. **Students own their questions.** Each student sees only what they uploaded, plus the questions of **accepted friends**.
3. **AI is a helper, not a decision-maker.**
   - It flags grammar and spelling problems.
   - It checks whether the marked answer is really correct.
   - If an answer looks wrong, it **asks the student** to confirm the change. Never overwrite silently.
   - If a question has no answer, the AI answers it **only after the student agrees**, and tags it as AI-answered.
4. **Marked answers come in many forms:** bold option, `الإجابة: ب`, `Answer: B`, or a ✓ / ★ beside the option. The parser must handle all of these.
5. **One unit = one topic area.** Units are created automatically from the questions; units never mix topics.
6. **Befriending merges banks.** When a friend request is accepted, units are rebuilt for both students from the combined questions. Removing the friend reverses this.
7. **Competition is the fun part.**
   - Two players get the **same questions in the same order** for **1 minute**.
   - A correct tap goes straight to the next question. A wrong tap shows "Incorrect", reveals the right answer, and then moves on.
   - New players get **100 credits** on first entry. The loser's credits drop and the winner's rise according to the score ratio (zero-sum).
   - Competition questions come **randomly from many users' banks**, not only the two players'.
   - Matches can be against a friend or against a **random online user**.
8. **Dashboard** shows each student's analysis: accuracy by topic, progress over time, speed, mistakes, and competition stats.

## 4. Reading Order

1. `AI-BRIEF.md` (this file)
2. `README.md` (overview, stack, roadmap)
3. `01-auth-and-onboarding.md`
4. `02-question-upload-and-ai-review.md`
5. `03-units-and-practice.md`
6. `04-friends-and-sharing.md`
7. `05-competition-arena.md`
8. `06-dashboard-and-analytics.md`
9. `07-admin-panel.md`
10. `08-database-schema.md`
11. `09-security.md` (mandatory rules for every stage, not an optional extra)
12. `10-rtl-and-arabic-ui.md` (mandatory: every screen in the Student App AND the Admin Panel must be right-to-left in Arabic, using logical CSS properties from the very first screen)
13. `11-ui-ux-design.md` (mandatory visual design system: build the design tokens and components first, then apply them screen by screen)

If two files seem to disagree, tell me before choosing. `08-database-schema.md` is the technical source of truth for data; the feature files are the source of truth for behaviour.

## 5. Technical Preferences

- **Frontend:** Next.js (React) + Tailwind CSS, deployed on Vercel, installable as a PWA.
- **Backend / DB / Auth / Realtime / Storage:** Supabase (PostgreSQL with Row Level Security).
- **AI:** Claude API, called **server-side only**. Never expose API keys to the browser.
- **Language:** Arabic content needs full **RTL support**. Arabic text and diacritics must survive upload, storage and display without corruption. The UI should be mobile-first.
- **Security:** enforce permissions in the database (RLS) and on the server. Never trust the client for scores, credits or admin checks.

## 5b. Things to Protect

- Never reveal the correct answer to a competition client before that player answers.
- Credit changes must happen in one database transaction and be logged in a ledger.
- The service-role key and the admin check must never reach the browser.
- Only `active`, answer-confirmed questions can enter the competition pool.

## 6. How I Want You to Work

1. **Build in the roadmap order** from `README.md`, one stage at a time. Finish and test a stage before starting the next.
2. **Before writing code for a stage, give me a short plan** (files to create, tables to add, anything unclear) and wait for my go-ahead.
3. Keep code simple, readable and commented where the logic is not obvious. I am a developer, but I like clear explanations.
4. Tell me exactly which commands to run, which environment variables to set, and which SQL to run in Supabase.
5. If something in the spec is ambiguous or technically risky, **ask me instead of guessing**.
6. Do not add features that are not in the spec without asking. Suggestions are welcome, kept short and clearly marked.
7. After each stage, give a short checklist so I can test it (use the Acceptance Criteria at the bottom of each spec file).

## 7. Known Open Questions

- Confirm the exam name: "NEET" vs. the Arabic NET/SET exam (only labels would change).
- Should the UI be Arabic only, or Arabic and English? Explanations in Malayalam or English?
- Competition wrong-answer rule: currently "show Incorrect, reveal the answer, then continue". Confirm with me if you need to change it.
- Credit formula constants (in `05-competition-arena.md`) are defaults and can be tuned.

## 8. First Task

Start with **Stage 1: authentication, email confirmation, and student/admin routing**. Begin by proposing the project structure and the Supabase setup steps, then wait for my approval.
