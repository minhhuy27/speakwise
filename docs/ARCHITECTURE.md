# Technical Architecture — SpeakWise

## 1. Tech Stack & Deployment Topology

| Layer | Technology | Purpose & Deployment Notes |
|---|---|---|
| **Framework & UI** | Next.js 15 (App Router), TypeScript (strict), Tailwind CSS, `shadcn/ui`, `Lucide Icons`, `Recharts`, `next-themes` | SSR/CSR hybrid pages + Responsive Desktop/Mobile UI in English with Light/Dark Mode. |
| **Hosting & BFF** | **Netlify** (`@netlify/plugin-nextjs`) | Hosts static assets, Next.js pages, and `/api/**` Route Handlers as Netlify Serverless Functions (Free Tier). |
| **Authentication** | **Firebase Authentication** (`GoogleAuthProvider`) | Passwordless Google Sign-In; client passes Firebase ID Token (JWT) for Firestore & API authorization. |
| **Database** | **Cloud Firestore** (Firebase Spark Free Plan) | NoSQL document store strictly scoped per user under `users/{uid}/...` with client offline persistence. |
| **AI & Dictionary** | **Google Gemini API** (`@google/genai`, `gemini-3.6-flash`) + **Free Dictionary API** | Server-side Gemini structured JSON generation via Next.js Route Handlers; `GEMINI_API_KEY` stays strictly server-only. |
| **Client Speech** | HTML5 `<audio>` + Browser `Web Speech API` (`window.speechSynthesis`) | Plays Dictionary `.mp3` pronunciation first; falls back to `en-US` / `en-GB` TTS synthesis. |
| **Validation & Test** | `zod`, `react-hook-form`, `Vitest`, `@testing-library/react` | Strict runtime schema validation for forms & APIs; deterministic unit tests for domain engines. |

---

## 2. Directory Structure (`src/`)

```text
speakwise/
├── docs/                           # Memory Bank (PRD, ARCHITECTURE, DESIGN, TASKS)
├── netlify.toml                    # Netlify build & Next.js plugin config
├── firestore.rules                 # Firestore security rules (uid isolation)
├── firestore.indexes.json          # Composite indexes for vocab/tests/mistakes
├── .env.example                    # Required public & server environment variables
└── src/
    ├── app/
    │   ├── layout.tsx              # Root layout, Fonts, ThemeProvider, AuthProvider, Toaster
    │   ├── (auth)/
    │   │   └── login/page.tsx      # Google Sign-In entry screen
    │   ├── (dashboard)/
    │   │   ├── layout.tsx          # Auth guard + Desktop Sidebar / Mobile BottomNav shell
    │   │   ├── page.tsx            # Overview Dashboard (Target vs Current, SRS Queue, Recent Trend)
    │   │   ├── vocab/
    │   │   │   ├── page.tsx        # Vocabulary Bank (Search, Tag/Status filters, Add/Edit modal)
    │   │   │   └── review/page.tsx # Distraction-free SRS Flashcard Focus View
    │   │   ├── tests/
    │   │   │   ├── page.tsx        # Test History list + Quick Full/Mini Test Logger
    │   │   │   └── [testId]/page.tsx # Test Detail + Part 1-7 Breakdown + Mistake Log & 1-click SRS
    │   │   ├── readiness/page.tsx  # Readiness Index, Part/Error Analytics & AI Coach
    │   │   └── settings/page.tsx   # Goal Onboarding/Settings + JSON Export/Import Backup
    │   └── api/
    │       └── ai/
    │           ├── vocab-enrich/route.ts       # POST: Dictionary API + Gemini Bilingual Vocab Enrichment
    │           ├── mistake-explain/route.ts    # POST: Gemini TOEIC Mistake Explanation (English)
    │           └── readiness-insight/route.ts  # POST: Gemini 2-Week Study Plan & Exam Verdict (English)
    ├── components/
    │   ├── ui/                     # shadcn/ui primitives
    │   ├── layout/                 # Sidebar, BottomNav, ThemeToggle, UserMenu
    │   ├── vocab/                  # VocabFormDialog, VocabTable, FlashcardView, AudioButton
    │   ├── tests/                  # TestLoggerDialog, PartInputs, MistakeList, MistakeDialog
    │   └── readiness/              # ReadinessGauge, ScoreTrendChart, PartAccuracyChart, AiCoachCard
    ├── lib/
    │   ├── firebase/
    │   │   ├── client.ts           # Firebase App, Auth, Firestore singleton initialization
    │   │   ├── auth.ts             # Google Sign-In/Sign-Out helpers & ID token getter
    │   │   ├── verify-token.ts     # Server-side Firebase JWT verification via Google public JWKS
    │   │   └── repositories/       # Typed Firestore CRUD wrappers (profile, vocab, tests, mistakes)
    │   ├── engines/                # 100% pure TypeScript domain logic (no Firebase/UI imports)
    │   │   ├── srs.ts              # SM-2 state transition & daily queue selector
    │   │   ├── score-converter.ts  # ETS L&R raw-to-990 conversion tables
    │   │   └── readiness.ts        # Readiness Index, weighted score, std-dev, Part weakness detector
    │   ├── validations/            # Zod schemas for forms & API payloads
    │   └── utils.ts                # cn(), date helpers, JSON export/import helpers
    └── types/
        └── domain.ts               # Core TypeScript interfaces shared across app & engines
```

---

## 3. Firestore Data Model & TypeScript Contracts (`src/types/domain.ts`)

All user data lives under `users/{uid}` so security rules and export/backup remain cleanly isolated.

```typescript
export type VocabStatus = 'new' | 'learning' | 'review' | 'mastered';
export type SrsGrade = 0 | 1 | 2 | 3; // 0: Again, 1: Hard, 2: Good, 3: Easy
export type TestMode = 'full_test' | 'mini_or_part';
export type ToeicPartKey = 'part1' | 'part2' | 'part3' | 'part4' | 'part5' | 'part6' | 'part7';
export type ErrorCategory =
  | 'vocab'
  | 'grammar'
  | 'listening_trap'
  | 'inference'
  | 'time_pressure'
  | 'careless';

export type ReadinessVerdict =
  | 'needs_foundation'
  | 'approaching'
  | 'almost_ready'
  | 'exam_ready';

// Document: users/{uid}
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  targetScore: number;           // 10..990, step 5 (default 750)
  targetListening?: number;      // 5..495, step 5
  targetReading?: number;        // 5..495, step 5
  targetExamDate: string | null; // ISO YYYY-MM-DD
  dailyNewWordsLimit: number;    // default 15
  onboardingCompleted: boolean;
  createdAt: string;             // ISO timestamp
  updatedAt: string;
}

// Document: users/{uid}/vocab/{vocabId}
export interface VocabCard {
  id: string;
  word: string;                  // Normalized lowercase trimmed key
  displayWord: string;           // Original casing/phrase
  ipa: string;                   // e.g. "/ˈkɑːn.trækt/"
  partOfSpeech: string;          // noun | verb | adj | adv | phrase | idiom
  meaningEn: string;             // Clear English definition in TOEIC business context
  meaningVi: string;             // Accurate Vietnamese meaning for bilingual comprehension
  exampleEn: string;
  exampleVi: string;
  audioUrl?: string;             // Dictionary API MP3 URL (optional, fallback to Web Speech)
  wordFamily: string[];          // e.g. ["contractual", "contractor"]
  collocations: string[];        // e.g. ["sign a contract", "breach of contract"]
  tags: string[];                // e.g. ["Contracts", "Part 5"]
  personalNote?: string;
  sourceTestId?: string;         // Linked TestAttempt.id if extracted from a test
  sourceMistakeId?: string;      // Linked MistakeRecord.id if extracted from a mistake
  // SM-2 SRS fields
  status: VocabStatus;
  easeFactor: number;            // Initial 2.5, min 1.3
  intervalDays: number;          // Initial 0
  repetitions: number;           // Initial 0
  lapses: number;                // Initial 0 (leech alert when >= 4)
  nextReviewAt: string;          // ISO timestamp
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartScore {
  correct: number;
  total: number;
}

// Document: users/{uid}/tests/{testId}
export interface TestAttempt {
  id: string;
  mode: TestMode;
  title: string;                 // e.g. "ETS 2024 - Test 01"
  source: string;                // e.g. "ETS", "Hacker", "Study4"
  takenAt: string;               // ISO YYYY-MM-DD
  durationMinutes: number;
  parts: Partial<Record<ToeicPartKey, PartScore>>;
  listeningCorrect: number;      // 0..100 (for full_test)
  readingCorrect: number;        // 0..100 (for full_test)
  listeningScore: number;        // 5..495 (0 for mini_or_part)
  readingScore: number;          // 5..495 (0 for mini_or_part)
  totalScore: number;            // 10..990 (0 for mini_or_part)
  isManualScoreOverride: boolean;
  reflectionNote?: string;
  mistakeCount: number;          // Denormalized counter
  createdAt: string;
  updatedAt: string;
}

// Document: users/{uid}/mistakes/{mistakeId}
// Top-level user subcollection so queries by testId AND across all tests require no Collection Group Index
export interface MistakeRecord {
  id: string;
  testId: string;                // Reference to TestAttempt.id
  testTitle: string;             // Denormalized for fast Readiness rendering
  part: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  questionNumber?: number;       // 1..200
  errorCategory: ErrorCategory;
  promptSnippet: string;         // Brief question/trap summary
  userAnswer?: string;
  correctAnswer?: string;
  explanation?: string;          // English explanation
  extractedWord?: string;
  linkedVocabId?: string;        // Populated after 1-click "Save to SRS"
  createdAt: string;
}
```

### Firestore Security Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    match /users/{uid} {
      allow read, write: if isOwner(uid);

      match /vocab/{vocabId} {
        allow read, write: if isOwner(uid);
      }
      match /tests/{testId} {
        allow read, write: if isOwner(uid);
      }
      match /mistakes/{mistakeId} {
        allow read, write: if isOwner(uid);
      }
    }
  }
}
```

### Recommended Firestore Composite Indexes (`firestore.indexes.json`)
- `vocab`: `(status ASC, nextReviewAt ASC)` — Fetch due SRS queue ordered by urgency.
- `tests`: `(mode ASC, takenAt DESC)` — Fetch latest `full_test` window for `Readiness Index`.
- `mistakes`: `(testId ASC, part ASC, createdAt DESC)` — Render sorted mistake list inside a test detail page.

---

## 4. Serverless API Contracts & Auth Verification

Every Route Handler under `src/app/api/ai/**`:
1. Extracts `Authorization: Bearer <firebaseIdToken>` from request headers.
2. Verifies the Firebase ID Token signature, `aud == NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `iss`, and `exp` via `jose` against Google's public JWKS endpoint (`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`) — requires **zero** Firebase Admin private key on Netlify.
3. Validates request body with `zod`; rejects invalid payloads with `400` and unauthenticated requests with `401`.
4. Calls Gemini `gemini-3.6-flash` with `responseMimeType: "application/json"` and strict schema enforcement.

### 4.1. `POST /api/ai/vocab-enrich`
- **Request:**
  ```json
  { "word": "reimburse", "contextSentence": "Employees will be reimbursed for travel expenses." }
  ```
- **Server Flow:** Parallel fetch to Free Dictionary API (`https://api.dictionaryapi.dev/api/v2/entries/en/reimburse`) for `ipa` + `audioUrl` AND Gemini `gemini-3.6-flash` for bilingual English + Vietnamese TOEIC-contextualized fields (if Dictionary API returns 404 for phrases/idioms, Gemini provides fallback `ipa` and `audioUrl` stays `null`).
- **Response (`200 OK`):**
  ```json
  {
    "displayWord": "reimburse",
    "ipa": "/ˌriː.ɪmˈbɜːrs/",
    "audioUrl": "https://api.dictionaryapi.dev/media/pronunciations/en/reimburse-us.mp3",
    "partOfSpeech": "verb",
    "meaningEn": "to pay back money to someone who has spent it for work or official business",
    "meaningVi": "hoàn lại tiền, bồi hoàn (chi phí công tác/mua sắm)",
    "exampleEn": "Please submit all receipts to be reimbursed for your business trip.",
    "exampleVi": "Vui lòng nộp toàn bộ hóa đơn để được hoàn lại chi phí chuyến công tác.",
    "wordFamily": ["reimbursement", "reimbursable"],
    "collocations": ["reimburse expenses", "be reimbursed for"],
    "suggestedTags": ["Finance", "Office"]
  }
  ```

### 4.2. `POST /api/ai/mistake-explain` (English Output)
- **Request:**
  ```json
  {
    "part": 5,
    "promptSnippet": "The manager asked all staff _____ the quarterly report before Friday.",
    "userAnswer": "A. submitting",
    "correctAnswer": "C. to submit",
    "errorCategory": "grammar"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "explanation": "The verb 'ask' follows the pattern 'ask + someone + to-infinitive'. Option A (gerund 'submitting') violates this complement structure.",
    "toeicTip": "When you see reporting/directive verbs (ask, advise, remind, require) followed by a person object, check for the to-infinitive option first.",
    "keyVocabulary": ["quarterly report", "submit"]
  }
  ```

### 4.3. `POST /api/ai/readiness-insight` (English Output)
- **Request:**
  ```json
  {
    "targetScore": 750,
    "targetExamDate": "2026-12-20",
    "readinessScore": 78,
    "verdict": "almost_ready",
    "recentFullTests": [
      { "title": "ETS 2024 Test 3", "takenAt": "2026-11-18", "listeningScore": 395, "readingScore": 335, "totalScore": 730, "durationMinutes": 118 }
    ],
    "partAccuracy": { "part1": 0.92, "part2": 0.80, "part3": 0.77, "part4": 0.73, "part5": 0.76, "part6": 0.75, "part7": 0.65 },
    "topErrorCategories": [
      { "category": "time_pressure", "count": 9 },
      { "category": "vocab", "count": 7 }
    ],
    "vocabStats": { "total": 320, "mastered": 145, "dueToday": 18 }
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "examDecision": "Reaching 750 is realistic, but complete 2 more timed full tests to confirm consistency before booking.",
    "strengths": ["Listening is steady around 395, with strong accuracy in Part 1 and Part 2."],
    "criticalGaps": ["Part 7 accuracy (65%) is pulled down by end-of-test time pressure."],
    "twoWeekActionPlan": [
      "Week 1: Drill Part 5 + Part 6 under 18 minutes combined to reserve at least 55 minutes for Part 7.",
      "Week 2: Complete two strict 120-minute Full Tests and clear all due SRS vocabulary cards daily."
    ]
  }
  ```

---

## 5. Pure Domain Engines (`src/lib/engines/`)

All domain math must reside in pure TypeScript modules with zero side effects and 100% Vitest coverage:

1. **`src/lib/engines/srs.ts`**
   - `calculateNextSrsState(card: Pick<VocabCard, 'status' | 'easeFactor' | 'intervalDays' | 'repetitions' | 'lapses'>, grade: SrsGrade, now?: Date): SrsTransitionResult`
   - `buildDailyStudyQueue(cards: VocabCard[], dailyNewWordsLimit: number, now?: Date): { dueCards: VocabCard[]; newCards: VocabCard[]; queue: VocabCard[] }`
2. **`src/lib/engines/score-converter.ts`**
   - `PART_MAX_QUESTIONS: Record<ToeicPartKey, number>` (`{ part1: 6, part2: 25, part3: 39, part4: 30, part5: 30, part6: 16, part7: 54 }`)
   - `estimateToeicScore(listeningCorrect: number, readingCorrect: number): { listeningScore: number; readingScore: number; totalScore: number }`
   - Uses standard ETS-calibrated lookup tables (clamped `0..100` raw -> `5..495` per section, rounded to nearest 5).
3. **`src/lib/engines/readiness.ts`**
   - `evaluateExamReadiness(fullTests: TestAttempt[], targetScore: number, targetExamDate: string | null, now?: Date): ReadinessReport`
   - Returns `{ isReliable: boolean; sampleSize: number; readinessIndex: number; verdict: ReadinessVerdict; weightedAverage: number; stdDeviation: number; scoreReadiness: number; stabilityScore: number; pacingScore: number; weakParts: ToeicPartKey[]; trendDelta: number }`.

---

## 6. Environment Variables (`.env.example` & `netlify.toml`)

```ini
# Public Firebase Client Config (Safe for Browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Server-Only Secrets (Configured in Netlify Dashboard, NEVER prefix with NEXT_PUBLIC_)
GEMINI_API_KEY=
```
