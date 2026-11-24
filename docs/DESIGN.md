# Design System & UI/UX Specification — SpeakWise

## 1. Design Direction & Language Rule
- **Aesthetic Philosophy — Academic Minimalism (Notion × Linear):** Clean surfaces, intentional whitespace, crisp borders, and distraction-free study & analytics layouts. Avoid heavy gradients or decorative clutter.
- **Theme Support:** Full **Light Mode** (warm/crisp paper-like default) and **Dark Mode** (comfortable evening study) powered by `next-themes` (`attribute="class"`).
- **UI Language Policy:**
  - **100% English Primary UI:** Every navigation link, page title, button, form label, chart legend, empty state, toast notification, and `aria-label` is written in English.
  - **Bilingual Vocabulary Display Only:** Vietnamese appears **only** as the secondary explanation (`meaningVi`, `exampleVi`) paired beneath the primary English definition (`meaningEn`, `exampleEn`) inside Vocabulary cards, modals, and SRS Flashcards.

---

## 2. Typography & Numeric Precision
- **Primary Sans Font:** `Plus Jakarta Sans` (fallback `Inter`, `system-ui`) — renders both English and Vietnamese diacritics cleanly at all weights.
- **Monospace Font:** `JetBrains Mono` — used strictly for:
  - `/IPA/` phonetic transcriptions on vocabulary entries.
  - Test duration timers (`120:00`) and keyboard shortcut badges (`Space`, `S`, `1`–`4`).
- **Tabular Numerals:** All TOEIC scores (`5–495`, `10–990`), accuracy percentages (`%`), and Part 1–7 counts MUST use `tabular-nums` (`font-variant-numeric: tabular-nums`) so tables and score cards align cleanly.

---

## 3. Color Tokens (Light & Dark Mode)

| Token Role | Light Mode (Hex) | Dark Mode (Hex) | Usage |
|---|---|---|---|
| `--bg-canvas` | `#F8FAFC` (Slate 50) | `#09090B` (Zinc 950) | Main application background |
| `--bg-surface` | `#FFFFFF` | `#18181B` (Zinc 900) | Cards, modals, data tables |
| `--bg-muted` | `#F1F5F9` (Slate 100) | `#27272A` (Zinc 800) | Secondary panels, unselected tags, hover states |
| `--border-subtle` | `#E2E8F0` (Slate 200) | `#27272A` (Zinc 800) | Crisp `1px solid` structural dividers |
| `--text-primary` | `#0F172A` (Slate 900) | `#FAFAFA` (Zinc 50) | Headings, vocabulary words, score values |
| `--text-secondary` | `#475569` (Slate 600) | `#A1A1AA` (Zinc 400) | Subtitles, column headers, dates |
| `--brand-primary` | `#4F46E5` (Indigo 600) | `#818CF8` (Indigo 400) | Primary CTAs, active nav items, accents |

### Semantic Status Tokens (SRS Grades & Readiness Verdicts)
| Status | Light Mode | Dark Mode | SpeakWise Usage |
|---|---|---|---|
| **Danger (`Rose`)** | `#E11D48` | `#FB7185` | SRS `Again (1)`, Verdict `Needs Foundation (0–49%)`, Leech badge, Part `< 60%` |
| **Warning (`Amber`)** | `#D97706` | `#FBBF24` | SRS `Hard (2)`, Verdict `Approaching (50–74%)`, Time-pressure warning |
| **Info (`Sky`)** | `#0284C7` | `#38BDF8` | SRS `Good (3)`, Verdict `Almost Ready (75–87%)`, Listening series |
| **Success (`Emerald`)** | `#059669` | `#34D399` | SRS `Easy (4)`, Verdict `Exam Ready (88–100%)`, `Mastered` status |

---

## 4. Responsive Layout Shell

### Desktop (`>= 1024px`)
- **Fixed Left Sidebar (`240px`):** Displays the **SpeakWise** logo, 4 main links (`Overview`, `Vocabulary`, `Test Log`, `Readiness`), `Settings`, Light/Dark theme toggle, and Google user profile footer.
- **Main Content Area:** Centered `max-width: 1200px` container with `24px–32px` padding.

### Mobile (`< 768px`)
- Collapses sidebar into a minimal **Top Header** (current page title + Theme Toggle) and a fixed `64px` **Bottom Navigation Bar** (`Overview`, `Vocab`, `Tests`, `Readiness`) optimized for one-handed thumb navigation during Flashcard reviews.

---

## 5. Core Screen & Component Specifications

### 5.1. Overview Dashboard (`/`)
- **Hero Summary Row (3 cards):**
  1. **Target vs. Current Form:** Displays weighted average score next to `Target Score` (e.g. `735 / 750`), delta badge (`-15 pts`), and exam countdown (`X days left`).
  2. **Today's SRS Queue:** Shows `Due` + `New` card counts with a prominent CTA button: **"Review Now (X cards)"**.
  3. **Exam Readiness Preview:** Compact progress ring showing `Readiness Index (%)` + verdict badge, linking directly to `/readiness`.
- **Recent Activity Row:** Mini 5-test score trend chart + latest vocabulary additions and recent logged mistakes.

### 5.2. Vocabulary Bank & SRS Focus View (`/vocab` & `/vocab/review`)
- **Vocabulary Bank (`/vocab`):**
  - Toolbar with instant search, status filter tabs (`All`, `Due`, `New`, `Learning`, `Mastered`, `Leech`), tag filter, and **"+ Add Word"** button.
  - **Smart Add Modal:** Enter word + optional context sentence -> click **"Auto-fill with AI"** -> populates `/IPA/`, `partOfSpeech`, **English Definition (`meaningEn`)**, **Vietnamese Meaning (`meaningVi`)**, bilingual example pair (`exampleEn`, `exampleVi`), `wordFamily`, `collocations`, and audio preview button before saving.
- **SRS Flashcard Focus View (`/vocab/review`):**
  - Hides sidebar/navigation for zero distractions; displays a slim top progress bar (`12 / 25 cards`).
  - **Front Side:** Large English word (`text-3xl font-bold`), audio speaker button (`[S]`), and optional context hint toggle.
  - **Back Side (smooth `200ms` flip):**
    1. Primary **English Definition (`meaningEn`)** with `/IPA/` and `partOfSpeech` badge.
    2. Secondary **Vietnamese Meaning (`meaningVi`)** in a subtle muted callout.
    3. TOEIC Example sentence (`exampleEn`) + Vietnamese translation (`exampleVi`), `wordFamily`, `collocations`, and `personalNote`.
  - **Bottom Grade Bar:** 4 semantic buttons (`Again`, `Hard`, `Good`, `Easy`) showing predicted next interval below each label (e.g. `1d`, `3d`, `7d`, `14d`) and Desktop shortcuts `[1]`–`[4]` (`min-height: 48px` touch targets on Mobile).

### 5.3. Test Log & Mistake Tracker (`/tests` & `/tests/[testId]`)
- **Test Logger Dialog (`TestLoggerDialog`):**
  - Two mode tabs: **Full Test (200 Qs)** and **Mini / Part Practice**.
  - 2-column layout: **Listening (Parts 1–4)** on the left, **Reading (Parts 5–7)** on the right, showing exact max denominators (e.g., `Part 5: [ ] / 30`).
  - **Sticky Live Score Preview:** Updates `Listening: XXX | Reading: XXX | Total: XXX / 990` in real time as counts are typed, with a *"Manual Score Override"* toggle.
- **Test Detail & Mistake Log (`/tests/[testId]`):**
  - Part 1–7 accuracy breakdown table.
  - Mistake list with semantic `errorCategory` badges (`Vocabulary`, `Grammar`, `Listening Trap`, `Inference`, `Time Pressure`, `Careless`).
  - Per-mistake quick actions: **"Explain with AI"** and **"+ Save to SRS"** (pre-populates the Smart Add modal with `sourceTestId` & `sourceMistakeId`).

### 5.4. Readiness & Analytics (`/readiness`)
- **Readiness Hero Card:** Large semi-circular Gauge displaying `Readiness Index (%)`, 4-tier English verdict badge, and 3 component progress bars (`Score Proximity 55%`, `Consistency 25%`, `Pacing & Timeline 20%`). Displays an informational banner if fewer than 3 `full_test` attempts exist: *"Log X more Full Tests to unlock high-confidence readiness analysis."*
- **Analytics Grid (Recharts):**
  - **Score Trend Line Chart:** `Total`, `Listening`, and `Reading` curves with a dashed `Target Score` line.
  - **Part 1–7 Accuracy Bar Chart:** 7 bars highlighting weak Parts below target threshold in `Amber`/`Rose`.
  - **Error Category Breakdown:** Visual distribution of logged mistake causes.
- **AI Coach Insight Card:** Displays Gemini's English `examDecision`, `strengths`, `criticalGaps`, and `twoWeekActionPlan` with loading, error, and refresh controls.

---

## 6. UX States & Accessibility Standards
- **Loading States:** Matching `Skeleton` placeholders for cards, tables, and charts while loading Firestore data; inline button spinners for `/api/ai/*` requests.
- **Empty States:** Every screen provides a clean minimal illustration, short English guidance, and one primary CTA (e.g., *"No full tests logged yet — Log your first test"*).
- **Feedback:** Concise English toast notifications for save, delete, and backup actions.
- **Accessibility:** Minimum WCAG AA contrast across Light & Dark modes; descriptive English `aria-label`s on all icon-only controls (audio speaker, edit, delete, theme toggle).
