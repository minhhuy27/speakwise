# Project Tasks & Memory Bank — SpeakWise

> **Legend:** `[x]` Completed | `[ ]` Pending | `[!]` Blocked / Bug
> **Worker Routing:** `[TIER: Hydrogen]` -> `@executor` | `[TIER: Carbon]` -> `@executor-heavy`
> **Language Policy:** All code, docs, comments, commit messages, and primary UI are 100% English. Vietnamese is used exclusively alongside English inside vocabulary explanations (`meaningEn` + `meaningVi`, `exampleEn` + `exampleVi`).

---

## Phase 0: Requirements Clarification & Memory Bank Initialization
- [x] Clarify product scope, TOEIC L&R focus, Netlify + Firebase + Gemini architecture, and English-first UI / bilingual vocabulary policy.
- [x] Write `docs/PRD.md` (Product requirements, SM-2 SRS rules, Test Tracker specs, Readiness Index formula).
- [x] Write `docs/ARCHITECTURE.md` (Tech stack, directory tree, Firestore schema & rules, AI API contracts, pure engine signatures).
- [x] Write `docs/DESIGN.md` (Academic Minimalism tokens, typography, responsive layout, screen & keyboard shortcut specs).
- [x] Write `docs/TASKS.md` (Tiered implementation roadmap & live memory bank).
- [x] Configure `.gitignore` (preserving `.antigravityrules`) and push initial `docs/` + `.gitignore` commit to GitHub.

---

## Phase 1: Project Initialization, Firebase Auth/DB Setup & UI Shell
- [x] `[TIER: Hydrogen]` Bootstrap Next.js 15 (App Router, TypeScript strict, Tailwind CSS, ESLint) + configure `Vitest` & `@testing-library/react`.
- [x] `[TIER: Hydrogen]` Install & configure `shadcn/ui`, `Plus Jakarta Sans` + `JetBrains Mono` fonts, `next-themes` (Light/Dark Mode), and semantic CSS variables from `docs/DESIGN.md`.
- [x] `[TIER: Hydrogen]` Create `src/types/domain.ts`, `.env.example`, `firestore.rules`, `firestore.indexes.json`, and `src/lib/firebase/{client,auth}.ts`.
- [x] `[TIER: Hydrogen]` Build English Google Sign-In page (`/login`), auth guard layout (`(dashboard)/layout.tsx`), responsive Desktop Sidebar (`240px`) + Mobile BottomNav (`64px`).
- [x] `[TIER: Hydrogen]` Build Goal Onboarding & Settings screen (`/settings`) to create/update `UserProfile` (`targetScore`, `targetListening`, `targetReading`, `targetExamDate`, `dailyNewWordsLimit`).

---

## Phase 2: Core Pure Engines & Unit Testing
- [x] `[TIER: Carbon]` Implement `src/lib/engines/srs.ts` (`calculateNextSrsState`, `buildDailyStudyQueue`) with full SM-2 state transitions, `mastered` promotion, and `leech` tracking (`lapses >= 4`).
- [x] `[TIER: Carbon]` Implement `src/lib/engines/score-converter.ts` (`PART_MAX_QUESTIONS`, `estimateToeicScore`) with ETS-calibrated Listening/Reading 5–495 conversion tables.
- [x] `[TIER: Carbon]` Implement `src/lib/engines/readiness.ts` (`evaluateExamReadiness`) with weighted score average, standard deviation stability, pacing/timeline scoring, 4-tier verdict mapping, and Part weakness detection.
- [x] `[TIER: Carbon]` Write comprehensive Vitest unit test suites under `src/lib/engines/__tests__/` covering boundary cases (0/100/200 raw scores, SM-2 grade 0–3 transitions, `< 3` vs `>= 3` full tests) and verify 100% pass.

---

## Phase 3: Smart Vocabulary & SRS Review Module
- [x] `[TIER: Carbon]` Implement `src/lib/firebase/verify-token.ts` (Firebase JWT verification via Google public JWKS using `jose`) and `POST /api/ai/vocab-enrich` (Free Dictionary API + Gemini `gemini-3.6-flash` structured JSON returning bilingual `meaningEn` + `meaningVi` & `exampleEn` + `exampleVi` + Zod validation).
- [x] `[TIER: Hydrogen]` Implement Firestore repository `src/lib/firebase/repositories/vocab.ts` and Zod schemas in `src/lib/validations/vocab.ts`.
- [x] `[TIER: Hydrogen]` Build Audio Pronunciation utility (`AudioButton` preferring Dictionary `.mp3` with `Web Speech API` `en-US`/`en-GB` fallback).
- [x] `[TIER: Hydrogen]` Build Vocabulary Bank (`/vocab`) with real-time search, status/tag/leech filters, and Smart Add/Edit Modal (`Auto-fill with AI` populating bilingual meanings).
- [x] `[TIER: Hydrogen]` Build distraction-free SRS Flashcard Focus View (`/vocab/review`) showing English definition prominently above Vietnamese explanation, smooth flip animation, interval previews on 4 grade buttons (`Again`, `Hard`, `Good`, `Easy`), and keyboard shortcuts (`Space`, `S`, `1`–`4`).

---

## Phase 4: TOEIC Test Tracker & Mistake Log Module
- [x] `[TIER: Hydrogen]` Implement Firestore repositories `src/lib/firebase/repositories/{tests,mistakes}.ts` and Zod validation schemas for `full_test` & `mini_or_part`.
- [x] `[TIER: Hydrogen]` Build Test History & Quick Test Logger (`/tests`) featuring 2-column Part 1–4 & Part 5–7 inputs and realtime sticky `/990` score preview + manual override toggle.
- [x] `[TIER: Hydrogen]` Build Test Detail & Mistake Log (`/tests/[testId]`) with Part 1–7 accuracy breakdown, `errorCategory` tagging, and 1-click **"+ Save to SRS"** linking `sourceTestId` & `sourceMistakeId`.
- [x] `[TIER: Carbon]` Implement `POST /api/ai/mistake-explain` (English output) and integrate optional **"Explain with AI"** trigger inside Mistake Log items.

---

## Phase 5: Readiness Analytics Dashboard & AI Coach
- [x] `[TIER: Hydrogen]` Build Overview Dashboard (`/`) combining Target vs. Current Score Hero, Exam Countdown, Daily SRS Queue CTA (`Review Now`), Readiness Preview Ring, and recent tests/mistakes.
- [x] `[TIER: Hydrogen]` Build Readiness & Analytics page (`/readiness`) with Readiness Gauge, 3 sub-score progress bars, Recharts Score Trend Line Chart, Part 1–7 Accuracy Bar Chart, and Error Category Breakdown.
- [x] `[TIER: Carbon]` Implement `POST /api/ai/readiness-insight` (English output) and integrate the **AI Coach Insight** card on `/readiness` with loading, error, and refresh states.

---

## Phase 6: Data Backup, Netlify Configuration & Production Verification
- [ ] `[TIER: Hydrogen]` Implement JSON Export / Import backup utility in `/settings` so users can safely back up or restore all `vocab`, `tests`, and `mistakes`.
- [ ] `[TIER: Hydrogen]` Configure `netlify.toml` (`@netlify/plugin-nextjs`), verify `next build`, ESLint, TypeScript typecheck (`tsc --noEmit`), and full `vitest` suite pass cleanly.

---

## Active Bugs / Blockers
- *None.*

## Next Steps
- Begin **Phase 6: Data Backup, Netlify Configuration & Production Verification**.
