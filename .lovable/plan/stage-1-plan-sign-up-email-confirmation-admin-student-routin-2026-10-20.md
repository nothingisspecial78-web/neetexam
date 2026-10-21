# Stage 1 plan: Sign-up, email confirmation, admin/student routing

Following your brief, I'm building in roadmap order and waiting for your go-ahead before each stage.

## Stack differences from the spec (please note)

- **Frontend:** this workspace runs TanStack Start (React + Tailwind v4), not Next.js. Routes, server functions and SSR are equivalent; deployment is on Lovable hosting instead of Vercel. PWA install will come in Stage 8.
- **Backend:** Lovable Cloud, which is managed Supabase (Postgres + RLS, Auth, Realtime, Storage). No separate account needed.
- **AI (Stage 2):** Lovable AI Gateway by default (strong Arabic-capable models, server-side only). If you specifically want Claude, I'll need your Anthropic key as a secret.

## What I'll build

1. Enable Lovable Cloud and email/password auth (with email confirmation on).
2. Design system: mobile-first, RTL-aware, Arabic-friendly fonts (e.g. Noto Naskh Arabic + a Latin pair), calm scholarly palette (no purple).
3. Pages:
  - `/` landing with Create account / Log in.
  - `/auth` sign-up (name, email, password ≥ 8, confirm) and login.
  - `/check-email`: "Open Gmail" (gmail.com only, else "Open your email app"), Resend with 60 s cooldown, Change email.
  - `/forgot-password` and `/reset-password`.
  - `/app` (protected student home placeholder + 3-step welcome tour + display name setup).
  - `/admin` (protected; 403 for non-admins; placeholder for Stage 7).
4. Routing: after login, a server function compares the user's email to the `SUPER_ADMIN_EMAIL` secret and returns `admin` or `student`. The email never reaches the browser.
5. Database: `profiles` table (per schema file) + trigger to create it on sign-up, RLS (public fields readable, update own only), `activity_log` (server-write only) logging sign-in events.

## Limits I want you to know about

- "Resend max 5/hour" and "5 failed logins, then 15-min lock": Cloud auth already rate-limits these; I'll add the 60 s client cooldown. A strict custom login lock would need extra server work — I'll skip it unless you want it.
- Confirmation link validity and the email's look use the default Cloud auth email. Custom branded emails need a sender domain; that can come later.

## Things you need to provide

- `SUPER_ADMIN_EMAIL` value (I'll prompt you to add it as a secret).
- Super admin email is: [abdullaarimbra1027@gmail.com](mailto:abdullaarimbra1027@gmail.com).
- Password is : abdu@1027

## Open questions (can answer now or later)

- UI language: Arabic only, or Arabic + English toggle?
- Exam label: "NEET" or "NET/SET"?
- The completely in Arabic language.

## Test checklist after Stage 1

- Sign up, unconfirmed user cannot open `/app`.
- Confirmation link logs you in and shows the welcome tour.
- Admin email lands on `/admin`; any other account gets 403 there.