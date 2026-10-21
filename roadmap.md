# Stage audit
- [x] Missing account profiles: signup trigger restored on this backend; app now creates a missing profile automatically.
- [ ] Signed-in verification of all stages — blocked: this backend has no accounts yet (needs sign-up).

# Stage 10 (RTL)
- [x] Right-to-left menus/dialogs, mirrored arrows, mixed-language question text, Arabic line height, install file in Arabic, admin charts flow right-to-left.
- [ ] Waiting on user: English language switch (big change), Arabic confirmation/reset emails (needs email sender domain).

# Stage 9 (security)
- [x] Leaked-password block, headers, AI injection guard, upload signature + 20/hour, friend limits, delete account, admin needs confirmed email, 90-day log retention.
- [ ] Ask first: CAPTCHA, login lockout after 5 failures, AI daily caps, report-question button, anti-farming caps, admin 2FA.

# Stage 8 (schema)
- [x] Schema audit: ledger match+reason, friend responded time, server-only write tables, indexes.

# Stage 7 (admin)
- [x] Activity log (auto-recorded events, filters, CSV, live refresh every 3s), active users, questions combined, user ban/unban, arena overview, admin actions logged, 403 for non-admin.
- [ ] Not built (ask first): AI cost monitor, editable system settings, 2FA.
