<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- After the remix reset, the migration directory starts empty; let the migration tool create its journal and snapshots on the next schema change so copied migrations are not replayed.
- Dashboard summaries use an authenticated, RLS-scoped database function and tested browser-safe calculation rules; new tests save answer snapshots atomically, and a protected profile trigger records real credit changes so analytics never infer missing history.
- Super-admin check is server-only (`getMyRole` compares the session email to the `SUPER_ADMIN_EMAIL` secret); never store an admin flag in the database — prevents self-promotion.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate); unconfirmed users have no session so they cannot reach them.
- Signup profiles are created by an auth lifecycle trigger with idempotent insertion; restore missing rows when installing the trigger so remixed accounts remain usable.
- Shared question validation and readiness rules live in `src/lib/question-rules.ts`; publishing rechecks saved owner-scoped drafts on the server so unresolved answers stay drafts.
- My Questions uses shared TanStack Query options in its route loader and component to keep filename metadata and saved decisions consistent.
- AI review uses a request-scoped gateway run-ID helper and sequential batches; a failed batch stops the upload's review run to prevent repeated denied or billed requests.
- Question content hashes share one browser-safe helper and are recomputed on text/options edits to keep duplicate detection current.
- Arabic PDF extraction compares logical and visual line order using recovered MCQ counts, preserving logical text unless the alternate order recovers more questions.
- Uploads use the free rule parser first; only when `needsAiReading` (`src/lib/parse-quality.ts`, tested) says it failed does AI read overlapping text chunks (3 at a time, first failure stops the run) — keeps neat files free and fast. AI reading never sets answers the file doesn't mark.
- Units: one unit per owner+topic, assigned by a DB trigger when a question becomes active; unit stats/completion rules live in `src/lib/units.ts` (tested) and every answer is stored with its mode for analytics; finished runs go to `test_results` with a mode, and unit best score uses full practice runs only (tests can be partial/retries).
- Friends' banks are combined at read time in `combineBanks` (`src/lib/units.ts`, tested): friend units join your unit of the same topic, duplicates collapse by content hash; RLS (`is_friend`, accepted only) decides visibility, so accept/remove/block take effect instantly with no unit rebuild job.
- Other students' profiles are never read from the profiles table directly (own row only); use the `search_students` / `related_profiles` security-definer functions, which return only name, avatar, question count (and last seen for related people) — keeps email and credits private.
- Blocks are a friendship row with status `blocked`, hidden from and undeletable by the blocked requester; the unordered-pair unique index stops re-requests.
- Arena: all match state changes go through security-definer SQL functions (`find_opponent`, `challenge_friend`, `respond_invite`, `match_question`, `answer_match`) so the server owns the timer, scoring and the answer key (never sent before a tap); clients only poll. Settlement runs in the `finishMatch` server function using the tested rules in `src/lib/arena.ts`, then the service-role-only `settle_match` applies the zero-sum transfer atomically — students can never write credits.
- Admin panel data comes only from `src/lib/admin.functions.ts`, which re-checks the super-admin email server-side on every call before using the service client; counting rules live in `src/lib/admin-stats.ts` (tested).
- Activity log rows are written by the `log_activity` DB trigger (signup, upload, publish, friends, matches) plus server functions; clients never write the log.
