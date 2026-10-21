# Stage 6 — Student dashboard and analysis

## What you’ll get
- Replace the signed-in student home with one Arabic dashboard while keeping quick access to uploads, questions, units, friends, and the arena.
- Overview: uploaded question count, completed/total units, overall accuracy, current credits and arena rank, and study streak.
- Performance: accuracy by topic with weakest topics highlighted; daily/weekly accuracy and question counts; average answer speed and trend.
- Mistake bank: frequently missed questions and a button to practise them.
- Test history: date, covered units, score, duration, and answer review for new tests.
- Competition: credits chart, wins/losses/draws, win rate, best one-minute match score, and recent opponents with credit changes.
- Simple recommendations without paid AI: weakest topic after at least 20 answers, inactivity reminder, and new shared questions from accepted friends.
- Filters: 7 days / 30 days / all time, unit, and practice / test / competition. Learning filters apply to learning metrics; competition has no unit association.

## Keep it simple and fast
- Preserve the existing Arabic design and onboarding; charts use real saved activity, with clear empty states.
- Load a compact summary in parallel with profile information, cache it briefly, and refresh it after sessions.
- Aim for dashboard loading under two seconds on mobile and measure it in the preview; actual loading depends on connection and account size.

## Existing history limitations
- Older tests do not link their individual answers to the saved test result. They can show scores and durations, but exact answer review will start with new tests; older tests will not show guessed answers.
- No credit ledger exists yet. Start recording real balance changes going forward, and show only supported historical match changes for older activity.

## Technical implementation
- Use authenticated summary queries with owner-scoped access and accepted-friend visibility; do not expose other students’ private profiles or balances.
- Add answer-to-test linkage and an atomic save path for new completed runs, keeping existing answer analytics intact.
- Add a server-written credit history initialized from each student’s current balance; students remain unable to write credits or credit history.
- Keep shared completion rules in the existing units helper; put dashboard aggregation and recommendation rules in a tested helper.
- Use TanStack Query loader/cache patterns, URL-based filters, and the existing chart tools.

## Verification
- Test exact calculations, filter boundaries, streaks, win rate, credit changes, and the 20-answer recommendation threshold.
- Check the signed-in dashboard, mistakes practice, a new test’s saved answer review, and refreshed charts after a session.
- Check mobile/desktop layout and measure load time with real account data.