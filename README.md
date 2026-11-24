# SpeakWise

SpeakWise is a TOEIC Listening & Reading study companion built with Next.js, Firebase, and Google Gemini. It unifies spaced-repetition vocabulary mastery, practice test analytics, mistake tracking, and exam readiness coaching in one workspace.

## Core Features

- **Bilingual SM-2 Vocabulary:** Build business-context English–Vietnamese flashcards with IPA, audio pronunciation (Dictionary API + Web Speech fallback), word families, collocations, and an SM-2 spaced-repetition review queue.
- **TOEIC Test & Mistake Tracker:** Log full 200-question tests or mini/part drills with automatic ETS scaled score estimation (or manual override), part-by-part accuracy breakdowns, structured mistake logs, AI trap explanations, and one-click vocabulary extraction.
- **Exam Readiness Index & AI Coach:** Track your composite Exam Readiness Index (0–100) across score momentum, part coverage, and vocabulary retention, alongside Recharts trend visualizations and personalized Gemini study coaching.
- **JSON Backup & Restore:** Export and restore your full study library (`profile` goals, `vocab`, `tests`, and `mistakes`) in Settings.

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling & Charts:** Tailwind CSS, Radix UI primitives, Lucide icons, Recharts, Sonner
- **Backend & Auth:** Firebase Authentication (Google Sign-In) & Cloud Firestore
- **AI Enrichment:** Google Gemini (`@google/genai`) + Free Dictionary API
- **Validation & Testing:** Zod, React Hook Form, Vitest, Testing Library

## Local Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   Copy `.env.example` to `.env.local` and fill in your Firebase web app config and Gemini API key:

   ```bash
   cp .env.example .env.local
   ```

   Required variables in `.env.local`:

   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `GEMINI_API_KEY`

3. **Deploy Firestore rules and indexes:**

   Ensure your Firebase project has `firestore.rules` and `firestore.indexes.json` deployed via Firebase CLI:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

4. **Start the development server:**

   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` — Start the Next.js development server
- `npm run test` — Run Vitest unit and component tests
- `npm run lint` — Run ESLint across `src`
- `npm run typecheck` — Run TypeScript type checking (`tsc --noEmit`)
- `npm run build` — Build the production bundle

## Netlify Deployment

SpeakWise includes `netlify.toml` preconfigured with Node.js 22 and `@netlify/plugin-nextjs`:

1. Connect your repository to Netlify.
2. Add all variables from `.env.example` (`NEXT_PUBLIC_FIREBASE_*` and `GEMINI_API_KEY`) in **Site configuration -> Environment variables**.
3. Trigger a deploy; Netlify will run `npm run build` and publish `.next` with Next.js App Router API routes enabled.
4. Add your Netlify domain to **Firebase Console -> Authentication -> Settings -> Authorized domains**.
