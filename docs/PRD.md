# Product Requirements Document (PRD) — SpeakWise

## 1. Product Overview
- **Application Name:** **SpeakWise**
- **Core Purpose:** A web application designed to help learners study and prepare for the **TOEIC Listening & Reading (990-point scale)** exam effectively through three integrated pillars:
  1. Smart Bilingual Vocabulary Notes & **SRS (Spaced Repetition System)** review.
  2. External Exam Log (**Test Tracker**) & **Mistake Log** for tests taken on external platforms or books (ETS, Hacker, Study4, etc.).
  3. Automated Proficiency & **Readiness Index (%)** evaluation to answer: *"Am I ready to register for the real exam?"*
- **Target Audience (MVP):** Individual learners or small study groups preparing for TOEIC L&R. Users sign in with Google (Firebase Auth) to sync progress seamlessly across desktop and mobile, landing directly on the working Dashboard with no marketing landing page required.
- **Language Policy:**
  - **100% English Primary Interface:** All navigation, headings, buttons, forms, charts, SRS grades, Readiness verdicts, error categories, empty states, toasts, and AI coaching outputs are written in English to immerse learners in an English environment.
  - **Bilingual Vocabulary Explanations Only:** Vietnamese is used **exclusively** inside vocabulary explanations alongside English (`meaningEn` + `meaningVi`, `exampleEn` + `exampleVi`) to ensure fast, unambiguous comprehension when learning new words.

---

## 2. Goal Onboarding & User Profile
Right after first sign-in (and editable anytime in Settings), users configure their personal `UserProfile`:

| Field | Rules & Default | Purpose |
|---|---|---|
| `targetScore` | `10` – `990` (multiple of `5`, default `750`) | Target total score used to compute `Readiness Index` and render chart reference lines. |
| `targetListening` / `targetReading` | Optional, `5` – `495` (multiple of `5`) | Tracks balance between Listening and Reading sections. |
| `targetExamDate` | Target exam date (`YYYY-MM-DD` or `null`) | Powers the exam countdown and remaining preparation timeline evaluation. |
| `dailyNewWordsLimit` | Integer (`5` – `50`, default `15`) | Caps daily new vocabulary cards injected into the SRS queue to prevent burnout. |

---

## 3. Module 1 — Smart Vocabulary & SM-2 SRS

### 3.1. AI + Dictionary Auto-fill (`/api/ai/vocab-enrich`)
- The user enters an English word or phrase (with an optional context sentence).
- The backend route combines:
  1. **Free Dictionary API:** Fetches standard `/IPA/` transcription and native `.mp3` pronunciation `audioUrl`.
  2. **Gemini API (`gemini-2.5-flash`):** Generates structured JSON containing `partOfSpeech`, **bilingual definitions** (`meaningEn` in concise TOEIC business/workplace English + `meaningVi` in accurate Vietnamese), a TOEIC-style example sentence with Vietnamese translation (`exampleEn`, `exampleVi`), `wordFamily`, `collocations`, and `suggestedTags`.
- All auto-filled fields remain editable before saving to the user's vocabulary bank.

### 3.2. Pronunciation Playback
- Prefers playing the real `.mp3` audio from Free Dictionary API.
- Automatically falls back to the browser's **Web Speech API** (`window.speechSynthesis`, supporting `en-US` / `en-GB`) when no audio URL is available.

### 3.3. Organization, Notes & Test Linking
- Supports TOEIC topic `tags` (*Office, Contracts, Marketing, Travel, Finance, HR...*).
- Links `sourceTestId` and `sourceMistakeId` when extracted directly from a logged test mistake.
- Includes `personalNote` for mnemonics, homophone traps, or easily confused word pairs.

### 3.4. SM-2 Spaced Repetition Engine
- **Card Lifecycle (`status`):** `new` -> `learning` -> `review` -> `mastered`.
  - A card reaches `mastered` when `intervalDays >= 21` and `repetitions >= 4`.
  - Tracks `lapses` (times forgotten). When `lapses >= 4`, the card is flagged as a **Leech Word** so the learner can prioritize reviewing its mnemonic note.
- **4 Flashcard Review Grades (`grade`):**

| Grade | Label | `repetitions` & `lapses` Update | `intervalDays` Update | `easeFactor` Update (min `1.3`) |
|---|---|---|---|---|
| `0` | **Again** | `repetitions = 0`, `lapses += 1` | `1` day | `max(1.3, easeFactor - 0.20)` |
| `1` | **Hard** | Keep `repetitions` unchanged | `max(1, round(intervalDays * 1.2))` | `max(1.3, easeFactor - 0.15)` |
| `2` | **Good** | `repetitions += 1` | 1st: `1` day; 2nd: `3` days; >=3rd: `round(intervalDays * easeFactor)` | Unchanged |
| `3` | **Easy** | `repetitions += 1` | `round(max(4, intervalDays * easeFactor * 1.3))` | `easeFactor + 0.15` |

---

## 4. Module 2 — TOEIC Test Tracker & Mistake Log

### 4.1. Two Logging Modes (`mode`)
Learners complete practice tests on external sources (ETS books, Hacker, Study4, etc.) and record results in SpeakWise:

1. **`full_test` (Full Test — 200 Questions / 120-Minute Standard):**
   - Input correct counts per Part following the official TOEIC L&R structure:
     - **Listening (100 Qs):** Part 1 (`/6`), Part 2 (`/25`), Part 3 (`/39`), Part 4 (`/30`).
     - **Reading (100 Qs):** Part 5 (`/30`), Part 6 (`/16`), Part 7 (`/54`).
   - Input actual time taken (`durationMinutes`), test `title`, `source`, date taken (`takenAt`), and general takeaway (`reflectionNote`).
   - Automatically converts raw Listening & Reading correct counts into scaled scores: `listeningScore` (`5–495`), `readingScore` (`5–495`), and `totalScore` (`10–990`), with an optional `isManualScoreOverride` toggle if the external platform already provided converted scores.

2. **`mini_or_part` (Part Practice / Mini-test):**
   - Select one or more practiced Parts, enter `correct / total` per Part and `durationMinutes`.
   - Contributes to longitudinal per-Part accuracy analytics (%) while being excluded from the 990-point Full Test trend and `Readiness Index`.

### 4.2. Mistake Log (`MistakeRecord`) & 1-Click SRS Extraction
- Inside any test detail view, learners can log key mistakes:
  - `part` (`1`–`7`), `questionNumber` (`1`–`200` optional), `userAnswer`, `correctAnswer`.
  - Root-cause `errorCategory`:
    - `vocab`: Unknown vocabulary or phrase meaning
    - `grammar`: Grammar, word form, tense, or clause structure
    - `listening_trap`: Homophones, connected speech, or audio paraphrase traps
    - `inference`: Deep reading comprehension or inference error
    - `time_pressure`: Rushed or guessed due to running out of time
    - `careless`: Misread negative/question prompt or careless slip
  - Brief `promptSnippet`, English `explanation` (with optional **"Explain with AI"** via `/api/ai/mistake-explain`), and `extractedWord`.
- **1-Click SRS Integration:** Clicking **"+ Save to SRS"** on any mistake opens the pre-filled Smart Vocabulary dialog linked to `sourceTestId` and `sourceMistakeId`.

---

## 5. Module 3 — Exam Readiness Assessment (`Readiness Index`)

### 5.1. Activation & Evaluation Window
- Shows a preliminary estimate from the 1st logged `full_test`.
- Unlocks full-confidence verdict once at least **3 `full_test` attempts** are recorded.
- Sliding evaluation window: uses the latest $N$ `full_test` attempts ($3 \le N \le 5$).

### 5.2. `Readiness Index` Formula (`0 – 100%`)
$$\text{Readiness Index} = 0.55 \times \text{ScoreReadiness} + 0.25 \times \text{StabilityScore} + 0.20 \times \text{PacingAndTimelineScore}$$

1. **`ScoreReadiness` (55% Weight) — Proximity to Target Score:**
   - Computes weighted average $\mu_w$ of the latest $N$ full tests (more recent tests carry linearly higher weights $1, 2, \dots, N$).
   - Exam-day safety buffer: $\text{safeTarget} = \min(990, \text{targetScore} + 25)$ to account for real-test pressure ($\pm 25$ pts).
   - Scoring curve: $\mu_w \ge \text{safeTarget} \Rightarrow 100$; $\mu_w = \text{targetScore} \Rightarrow 85$ (linear interpolation between `targetScore` and `safeTarget`); linearly decreases from `85` to `0` at `targetScore - 200` (clamped at `0`).

2. **`StabilityScore` (25% Weight) — Score Consistency:**
   - Computes standard deviation $\sigma$ of total scores in the window and `passRate` (share of window tests $\ge \text{targetScore}$).
   - $\sigma$-based component: $\sigma \le 20 \Rightarrow 100$; $\sigma \ge 80 \Rightarrow 20$ (linear interpolation in between; flags volatile performance).
   - Combined as `0.7 * sigmaScore + 0.3 * (passRate * 100)`.

3. **`PacingAndTimelineScore` (20% Weight) — Time Management & Exam Timeline:**
   - **Time Pacing (`onTimeRate`):** Share of window `full_test` attempts completed within `<= 120` minutes.
   - **Score Trajectory (`trendDelta`):** Compares recent half vs earlier half of the window to detect upward or downward momentum.
   - **Timeline Feasibility:** Compares remaining score gap $\max(0, \text{targetScore} - \mu_w)$ against days left until `targetExamDate` against a realistic improvement pace (~`45` points per `30` days of steady practice).

### 5.3. Four Readiness Verdicts
| Score Range | `verdict` Key | Display Badge | Recommended Action |
|---|---|---|---|
| `0% – 49%` | `needs_foundation` | **Needs Foundation** | Rebuild core vocabulary and high-yield foundational Parts (Part 1, 2, 5). |
| `50% – 74%` | `approaching` | **Approaching** | Closing the gap, but not yet consistently at target; drill weakest Parts. |
| `75% – 87%` | `almost_ready` | **Almost Ready** | Near or at target; complete 1–2 more stable full tests and fix recurring error categories. |
| `88% – 100%` | `exam_ready` | **Exam Ready** | Weighted average exceeds safe target buffer with strong consistency; ready to book the exam. |

### 5.4. Analytics Charts & AI Coach
- **Visualizations:**
  - Score Trend Line Chart (`Total`, `Listening`, `Reading`) with a dashed `Target Score` reference line.
  - Part 1–7 Accuracy Bar Chart highlighting weak Parts dragging down the score.
  - Error Category Breakdown chart showing top root causes of lost points.
- **AI Coach (`/api/ai/readiness-insight`):** On-demand button sending aggregated score history, Part 1–7 accuracy, top error categories, and SRS mastery stats to Gemini, returning an English exam-booking recommendation and a focused 2-week study plan.

---

## 6. MVP Non-Goals (Out of Scope)
- No built-in 120-minute copyrighted ETS audio/test simulator.
- No TOEIC Speaking & Writing modules in v1.0.
- No public social feeds, leaderboards, community deck sharing, or payment gateways.
