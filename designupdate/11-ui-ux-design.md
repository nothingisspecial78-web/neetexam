# 11: UI/UX Design System (Professional, Attractive, Easy to Understand)

## Goal
Make the app look **professional, modern and inviting**, and so simple that a first-time student understands every screen in a few seconds without instructions. Design applies to both the Student App and the Admin Panel. All rules here must work in **RTL (Arabic)** as defined in `10-rtl-and-arabic-ui.md`.

## 1. Design Principles
1. **Clarity first:** one main action per screen, with a clear title saying what the screen is for.
2. **Calm and focused:** lots of white space; study screens have no distractions.
3. **Rewarding:** progress, streaks, credits and small celebrations keep students motivated.
4. **Scholarly warmth:** a look that suits Arabic literature (elegant, trustworthy, a little traditional), but modern.
5. **Mobile-first:** most students use phones. Thumb-friendly, one-handed layout, bottom navigation.
6. **Consistent:** the same colours, spacing, buttons and wording everywhere.
7. **Feedback always:** every tap gives a visible response (pressed state, loading, success, error).

## 2. Brand and Visual Style
- **Mood:** scholarly, fresh, friendly. Think "elegant study companion", not "boring exam portal".
- **Shapes:** rounded corners (12-16px cards, 10-12px buttons, full-round for chips/avatars), soft shadows.
- **Pattern (optional):** a very subtle geometric (Islamic-pattern-inspired) texture at 4-6% opacity on hero areas and empty states only. Never behind text-heavy content.
- **Illustrations:** simple flat illustrations for empty states, onboarding and success screens (books, pens, trophies). Consistent style, no clip-art mix.
- **No stock photos of people.** No copyrighted artwork or logos.

## 3. Colour Palette (design tokens)
Deep emerald as the main colour, warm gold as the accent, warm off-white backgrounds.

```css
:root {
  /* Brand */
  --primary-50:  #ECFDF5;
  --primary-100: #D1FAE5;
  --primary-300: #6EE7B7;
  --primary-500: #10B981;
  --primary-600: #0F8F6B;   /* main buttons, links */
  --primary-700: #0B6F54;   /* hover, headers */
  --primary-900: #064E3B;   /* dark surfaces */

  --accent-400:  #F5C451;   /* gold: credits, trophies, highlights */
  --accent-500:  #E0A82E;
  --accent-600:  #B8861A;

  /* Neutrals (warm) */
  --bg:          #FBFAF7;   /* app background */
  --surface:     #FFFFFF;   /* cards */
  --surface-2:   #F3F1EA;   /* subtle panels */
  --border:      #E6E2D6;
  --text:        #1F2A24;   /* main text */
  --text-muted:  #5E6B63;

  /* Feedback */
  --success:     #16A34A;   --success-bg: #DCFCE7;
  --error:       #DC2626;   --error-bg:   #FEE2E2;
  --warning:     #D97706;   --warning-bg: #FEF3C7;
  --info:        #2563EB;   --info-bg:    #DBEAFE;
}
```

- **Dark mode:** required. Background `#0F1714`, surface `#16211C`, border `#25352D`, text `#E8F0EB`, muted `#9DB0A5`. Keep the same brand hues, slightly lighter.
- Contrast: all text must meet **WCAG AA** (4.5:1; 3:1 for large text). Never rely on colour alone, so add icons/labels (✓ / ✕) for correct/wrong.
- Colour roles: green = go/correct, gold = reward/credits, red = wrong/danger only, blue = information.

## 4. Typography
- **Arabic:** Noto Naskh Arabic (question text, reading), Cairo or Tajawal (headings, buttons, UI). **English/Latin:** Inter.
- Scale (mobile / desktop): H1 28/36px, H2 22/28px, H3 18/22px, body 16/17px, small 14px, caption 12-13px.
- Arabic line height 1.8 for reading text, 1.5 for UI labels. Weights: regular 400, medium 500, bold 700 (no more than 3).
- Question text is the star: large (18-20px), centred or start-aligned with generous spacing.
- Short lines (max ~65 characters) for readability on desktop.

## 5. Spacing, Layout and Grid
- 4px base unit; use 4, 8, 12, 16, 24, 32, 48.
- Page padding 16px on mobile, 24-32px on desktop; cards padded 16-20px.
- **Mobile:** single column, bottom tab bar (Home, Units, Arena, Friends, Profile), large 48px touch targets.
- **Desktop/tablet:** sidebar (on the **right** in RTL) + content area, max content width 1200px.
- **Admin panel:** denser layout with a sidebar, summary cards at the top, then charts and tables.

## 6. Core Components
Build a reusable component library (shadcn/ui + Tailwind recommended, Lucide icons, Framer Motion for animation).

| Component | Design notes |
|---|---|
| **Primary button** | Emerald fill, white text, 48px tall, rounded, pressed scale 0.98, loading spinner state |
| **Secondary button** | White/outline with emerald text |
| **Danger button** | Red, only for destructive actions with a confirm dialog |
| **Cards** | White, 1px warm border, soft shadow, 16px radius, hover lift on desktop |
| **Inputs** | 48px tall, clear label above, helper/error text below, visible focus ring in emerald |
| **Chips/badges** | Rounded, used for topic tags, status (New, In progress, Completed), 🤖 AI-answered |
| **Progress bar** | Rounded, emerald fill with a gold milestone marker; fills right-to-left in RTL |
| **Option button (MCQ)** | Full-width card with the option letter in a circle; states: default, hover, selected, correct (green + ✓), wrong (red + ✕) |
| **Toasts** | Top, auto-dismiss in 4s, with icon and colour |
| **Modals/sheets** | Bottom sheet on mobile, centred dialog on desktop |
| **Skeleton loaders** | Replace spinners for lists, cards and charts |
| **Empty states** | Illustration + one-line explanation + one clear button |
| **Avatar** | Circle with initial or image, with an online dot |

## 7. Screen-by-Screen Design

### 7.1 Welcome, Sign-up and Login
- Friendly hero: app name and logo, one-line promise ("Master Arabic literature, question by question"), illustration.
- Short forms, large buttons, show/hide password, clear errors in plain Arabic.
- **"Check your Gmail" screen:** big envelope illustration, a clear **Open Gmail** button, a Resend button with a countdown, and a Change email link.

### 7.2 Student Home (Dashboard)
Top to bottom on mobile:
1. Greeting + avatar + credits chip (gold) + streak flame.
2. **"Continue" card:** the last unit with a progress ring and a big **Continue** button.
3. Quick actions row: **Upload questions**, **Random unit**, **Challenge** (icons with short labels).
4. Stats cards: accuracy %, questions answered, units completed.
5. Weak topics list with a "Practise" button for each.
6. Progress chart (last 7 days).
Keep it scannable: max 4-5 blocks above the fold.

### 7.3 Upload Questions (guided stepper)
A 4-step stepper at the top: **Upload → Extract → Review → Publish**.
- Step 1: large drag-and-drop zone (tap on mobile) listing allowed types, with a tiny sample-format "?" help sheet.
- Step 2: a friendly progress animation with text ("Found 120 questions...").
- Step 3 (Review): summary chips on top (✅ 98 clean, ⚠️ 14 suggestions, ❌ 5 wrong answers, ❓ 3 no answer). Cards show original vs AI suggestion side by side (stacked on mobile) with clear buttons: **Accept**, **Keep mine**, **Edit**. Wrong-answer cards use a red-tinted border and an explanation sentence.
- Step 4: success screen with a small celebration animation and "N questions added to M units".

### 7.4 Units
- Grid of unit cards (2 columns on mobile). Each shows: topic icon + colour, name, question count, a circular progress ring, status chip, and a friend badge for shared units.
- Top bar: search, filter (All / New / In progress / Completed), and a prominent **🎲 Random unit** button.

### 7.5 Practice Screen (distraction-free)
- Thin top bar: close (✕), progress bar, question counter (3/20).
- Question in a large card; options below as big tappable cards.
- After the answer: correct option turns green with ✓, a wrong choice turns red with ✕, and a collapsible "Why?" explanation slides up; a big **Next** button appears.
- No bottom tab bar, to avoid distraction.

### 7.6 Unit Test
- Setup sheet: pick completed units (chips), number of questions, optional timer.
- Exam-style screen (no instant feedback), a question palette to jump around, and a confirm dialog on submit.
- Result: big score ring, correct/wrong/time, topic breakdown bars, and **Retry wrong answers**.

### 7.7 Friends
- Tabs: Friends / Requests / Sent. Rows with avatar, name, online dot, and **Challenge** button.
- Search bar at the top; the Accept/Decline buttons on requests are large and clear.

### 7.8 Competition Arena (the most exciting screen)
- **Lobby:** a bold dark-emerald hero card with the big credits number in gold, **Find opponent** and **Challenge a friend** buttons, a leaderboard preview, and recent matches.
- **Searching:** a pulsing radar animation and "Looking for an opponent...", with a Cancel button.
- **Match found:** both avatars slide in with "VS", then a 3-2-1 countdown.
- **Live match:** a timer ring/bar at the top (turns amber at 15s and red at 5s), both scores shown as chips (yours on the right in RTL), one question at a time, and big option cards. Wrong tap: a quick shake, red "Incorrect", the correct answer highlighted, then the next question. Correct tap: a green flash, a small "+1" pop, then instantly the next question.
- **Result:** a Victory (confetti, gold) or Defeat (calm, encouraging) screen, with a credit change animation (+32 / -32 counting up), score comparison and **Play again** / **Home** buttons.

### 7.9 Profile and Settings
Avatar, name, credits, badges, language toggle (العربية / English), dark mode toggle, digit style (٠١٢ or 012), logout, delete account.

### 7.10 Admin Panel
- Clean, data-focused: top summary cards (Online now, Active today, Total users, Total questions), line chart for daily active users, bar chart for uploads, a searchable console-log table with colour-coded event badges, and filters.
- Same palette and components as the student app, but denser, with a sidebar. Add a clear "Admin" tag in the header.

## 8. Gamification Visuals
- **Credits:** a gold coin icon, with count-up animation on change.
- **Streak:** a flame icon with the day count.
- **Levels/ranks:** simple named ranks (for example Beginner → Reader → Scholar → Master) shown as badges based on credits, with a progress bar to the next rank.
- **Achievements:** small badges (first upload, 100 questions, 7-day streak, first win). Show a toast and a badge shelf on the profile.
- Keep it tasteful: a few celebrations, never childish or noisy.

## 9. Motion and Micro-interactions
- Durations: 150-250ms for UI, 300-400ms for transitions, easing `ease-out`.
- Page transitions: soft fade/slide (direction mirrored in RTL).
- Button press, card hover, option selection, progress fill, number count-up, confetti on wins and on 100% unit completion.
- Respect `prefers-reduced-motion`: turn off big animations and confetti.
- Never delay the user: animations must not block the next question in the arena.

## 10. Writing and Tone (Arabic and English)
- Friendly, short, encouraging. Use simple Modern Standard Arabic; avoid jargon.
- Buttons are verbs: "ارفع الأسئلة", "ابدأ", "التالي". Error messages say what happened and what to do next.
- Celebrate effort ("أحسنت!") and be kind in defeat ("محاولة جيدة، جرّب مرة أخرى").
- Every empty state explains the next step.

## 11. Accessibility
- WCAG 2.1 AA: contrast, focus rings, keyboard navigation, correct labels, `aria-live` for toasts and match score updates.
- Minimum touch target 44x44px; adjustable text size in settings.
- Colour-blind safe: correct/wrong also use icons and text.
- Screen-reader order must follow the RTL visual order.

## 12. Performance and Polish
- Mobile load under 2.5s: optimise fonts (subset Arabic, `font-display: swap`), lazy-load charts and illustrations, use skeletons.
- Smooth 60fps animations (animate `transform` and `opacity` only).
- Installable PWA: app icon, splash screen in brand colours, theme colour `#0F8F6B`.
- Offline-friendly: practising already-loaded units works offline; show a clear offline banner.

## 13. Build Order for the AI
1. Create the **design tokens** (colours, fonts, spacing, radius, shadows) in `tailwind.config` and global CSS; add light and dark themes.
2. Build the **component library** (section 6) and a simple `/design` preview page that shows all components in light, dark, LTR and RTL.
3. Build the **layout shells**: mobile bottom tabs, desktop sidebar (right in RTL), admin shell.
4. Apply the design screen by screen following section 7, starting with sign-up, home, upload, practice, then arena and admin.
5. Add motion and gamification (sections 8 and 9).
6. Run the accessibility and performance checks (sections 11 and 12).

## Acceptance Criteria
- [ ] A new student can complete sign-up, upload and first practice without any help text.
- [ ] Every screen has one obvious primary action.
- [ ] The palette, fonts, spacing and components are identical across the Student App and the Admin Panel.
- [ ] Light and dark modes both look polished; all text meets AA contrast.
- [ ] Every screen looks correct in RTL on a phone and on desktop.
- [ ] Practice and arena option states (default, selected, correct, wrong) are unmistakable.
- [ ] Animations are smooth, and reduced-motion is respected.
- [ ] Empty, loading and error states are designed for every list and page.
- [ ] Lighthouse scores: Performance 85+, Accessibility 95+ on mobile.
