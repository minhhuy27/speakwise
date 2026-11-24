# Production Deployment Runbook — SpeakWise

This runbook provides step-by-step instructions to deploy **SpeakWise** to production using **Firebase** (Authentication & Cloud Firestore) and **Netlify** (Next.js 15 App Router + Serverless API Routes).

---

## 1. Overview & Production Architecture

| Component | Service / Runtime | Role in Production |
|---|---|---|
| **Web App & BFF** | **Netlify** (`@netlify/plugin-nextjs`, Node.js `22`) | Serves Next.js App Router pages and runs `/api/ai/*` Route Handlers as Netlify Serverless Functions. |
| **Authentication** | **Firebase Authentication** (`GoogleAuthProvider`) | Handles Google Sign-In and issues Firebase ID Tokens (JWT) verified server-side via Google public JWKS (`jose`). |
| **Database** | **Cloud Firestore** (Spark Free Plan) | Stores user-isolated documents under `users/{uid}`, `users/{uid}/vocab`, `users/{uid}/tests`, and `users/{uid}/mistakes`. |
| **AI & Dictionary** | **Google Gemini API** (`gemini-3.6-flash` default) + **Free Dictionary API** | Enriches bilingual vocabulary, explains TOEIC mistakes, and generates 2-week readiness action plans server-side. |

### Prerequisites
- GitHub repository pushed and up to date: `minhhuy27/speakwise` (`main` branch).
- Google account with access to [Firebase Console](https://console.firebase.google.com/) and [Google AI Studio](https://aistudio.google.com/).
- [Netlify](https://app.netlify.com/) account connected to your GitHub account.
- Local toolchain (for pre-flight checks): **Node.js `22.x`** and **`npm`**.

---

## 2. Step 1: Firebase Project Setup (Auth + Firestore)

### 2.1. Create Firebase Project & Register Web App
1. Open [Firebase Console](https://console.firebase.google.com/) and click **Add project** (e.g., `speakwise-prod`). Google Analytics is optional.
2. In **Project Overview**, click the **Web (`</>`)** icon to register a Web App (e.g., `speakwise-web`). Do **not** check "Also set up Firebase Hosting" (Netlify handles hosting).
3. Copy the 6 client configuration values from `firebaseConfig` — you will need them for `.env.local` and Netlify:
   - `NEXT_PUBLIC_FIREBASE_API_KEY` (`apiKey`)
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (`authDomain`)
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (`projectId`)
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (`storageBucket`)
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (`messagingSenderId`)
   - `NEXT_PUBLIC_FIREBASE_APP_ID` (`appId`)

### 2.2. Enable Google Authentication
1. Go to **Build -> Authentication -> Get started**.
2. Open the **Sign-in method** tab and select **Google**.
3. Toggle **Enable**, set a **Project support email**, and click **Save**.

### 2.3. Provision Cloud Firestore
1. Go to **Build -> Firestore Database -> Create database**.
2. Select **Start in production mode** (the app uses strict owner-only rules).
3. Choose a region close to your users — **`asia-southeast1` (Singapore)** is recommended for lowest latency in Vietnam and Southeast Asia.

### 2.4. Deploy `firestore.rules` & `firestore.indexes.json`
The repository defines strict UID isolation in `firestore.rules` (`users/{uid}` and its `vocab`, `tests`, and `mistakes` subcollections) and 3 composite indexes in `firestore.indexes.json`:
- `vocab`: `(status ASC, nextReviewAt ASC)`
- `tests`: `(mode ASC, takenAt DESC)`
- `mistakes`: `(testId ASC, part ASC, createdAt DESC)`

Choose **either** Option A (fastest, zero CLI setup) or Option B (CLI):

- **Option A — Firebase Console UI (No CLI required):**
  1. Open **Firestore Database -> Rules**, paste the full contents of `firestore.rules` from the repository, and click **Publish**.
  2. Open **Firestore Database -> Indexes -> Composite**, and verify or create the 3 composite indexes listed in `firestore.indexes.json` (status should transition from *Building* to *Enabled*).

- **Option B — Firebase CLI:**
  1. Install and sign in:
     ```bash
     npm install -g firebase-tools
     firebase login
     ```
  2. Create a minimal `firebase.json` in the project root (note: `firebase.json` is not pre-created in the repository):
     ```json
     {
       "firestore": {
         "rules": "firestore.rules",
         "indexes": "firestore.indexes.json"
       }
     }
     ```
  3. Link your Firebase project and deploy rules & indexes:
     ```bash
     firebase use --add
     firebase deploy --only firestore:rules,firestore:indexes
     ```

---

## 3. Step 2: Obtain Gemini API Key (`GEMINI_API_KEY`)

1. Open [Google AI Studio API Keys](https://aistudio.google.com/apikey) and click **Create API key** (attach it to a Google Cloud project; the Free Tier suffices for personal/small-group usage).
2. Copy the generated key for `GEMINI_API_KEY`.
3. **Model Configuration:** `src/lib/ai/gemini.ts` sets:
   ```ts
   export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
   ```
   You can optionally set `GEMINI_MODEL` in environment variables if you ever need to switch Gemini model versions without changing code.

> **Security Rule:** NEVER prefix `GEMINI_API_KEY` with `NEXT_PUBLIC_`, and NEVER commit `.env` or `.env.local` to Git. `GEMINI_API_KEY` is read strictly inside server-side Next.js Route Handlers (`/api/ai/*`).

---

## 4. Step 3: Local Pre-Flight Verification

Before deploying to Netlify, verify everything locally with real credentials:

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Populate all 7 variables in `.env.local` (`NEXT_PUBLIC_FIREBASE_*` + `GEMINI_API_KEY`).
3. Run the full verification suite:
   ```bash
   npm install
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```
4. Start the local server (`npm run dev`), open `http://localhost:3000/login`, and confirm Google Sign-In works cleanly (`localhost` is authorized by default in Firebase Auth).

---

## 5. Step 4: Deploy to Netlify

1. Log in to [Netlify](https://app.netlify.com/) and click **Add new site -> Import an existing project -> Deploy with GitHub**.
2. Select repository **`minhhuy27/speakwise`** and branch **`main`**.
3. Confirm Netlify reads `netlify.toml` automatically:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Node version:** `22`
   - **Plugin:** `@netlify/plugin-nextjs`
4. Open **Site configuration -> Environment variables -> Add a variable** and configure all keys below:

| Variable | Visibility / Scope | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public (Builds + Functions + Runtime) | Yes | Firebase Web App `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public | Yes | `<project-id>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public | Yes | Used by both client SDK and server JWT `aud`/`iss` verification |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public | Yes | Firebase Web App `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public | Yes | Firebase Web App `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public | Yes | Firebase Web App `appId` |
| `GEMINI_API_KEY` | **Secret** (Functions / Runtime only) | Yes | Never exposed to browser |
| `GEMINI_MODEL` | Server config | No | Optional override; defaults to `gemini-3.6-flash` |

5. Click **Deploy site** (or **Trigger deploy -> Deploy site** after adding env vars) and wait until the deploy status shows **Published / Site is live**.
6. *(Optional)* To attach a custom domain, configure **Domain management -> Add a domain** in Netlify and provision automatic Let's Encrypt HTTPS.

---

## 6. Step 5: Authorize Production Domain in Firebase Auth (CRITICAL)

Firebase blocks Google Sign-In popups on any domain that is not explicitly allowlisted.

1. Open **Firebase Console -> Build -> Authentication -> Settings -> Authorized domains**.
2. Click **Add domain** and enter your live Netlify hostname (e.g., `speakwise-app.netlify.app`, **without** `https://` or trailing `/`).
3. If you added a custom domain in Netlify, add that custom domain (both apex and `www` if used) as well.

> Skipping this step causes Google Sign-In to fail with `Firebase: Error (auth/unauthorized-domain)`.

---

## 7. Step 6: Post-Deployment Production Smoke-Test Checklist

Run through all 6 checks on your live `https://<your-site>.netlify.app` URL:

1. **Auth & Onboarding (`/login` -> `/settings?onboarding=1`):**
   - `/login` renders cleanly without the *"Firebase environment setup required"* warning card.
   - Clicking **Continue with Google** completes sign-in and redirects first-time users to Goal Onboarding; saving `targetScore`, `targetExamDate`, and `dailyNewWordsLimit` persists to Firestore `users/{uid}` and navigates to `/`.
2. **Smart Bilingual Vocabulary (`/vocab` -> `/vocab/review`):**
   - Click **+ Add Word**, type `reimburse`, and click **Auto-fill with AI** (`/api/ai/vocab-enrich`). Verify English `meaningEn`, Vietnamese `meaningVi`, `/IPA/`, and audio playback populate cleanly.
   - Save the card, open **Review Now** (`/vocab/review`), flip with `Space`, and grade with `1`–`4` (`Again`, `Hard`, `Good`, `Easy`).
3. **TOEIC Test Log & Mistake Extraction (`/tests` -> `/tests/[testId]`):**
   - Log a `Full Test (200 Qs)` and verify real-time ETS `/990` score conversion.
   - Open the test detail page, add a mistake, click **Explain with AI** (`/api/ai/mistake-explain`), and click **+ Save to SRS** to confirm 1-click vocabulary linking (`Saved to SRS`).
4. **Exam Readiness & AI Coach (`/readiness`):**
   - Verify the Readiness Gauge, Score Trajectory Line Chart, Part 1–7 Accuracy Bar Chart, and Error Category Breakdown render cleanly.
   - Click **Generate AI Study Plan** (`/api/ai/readiness-insight`) and verify the English `Exam Decision` and `2-Week Action Plan` render.
5. **Backup Export (`/settings`):**
   - Click **Export Backup (.json)** and confirm `speakwise-backup-YYYY-MM-DD.json` downloads with your `vocab`, `tests`, and `mistakes` records.
6. **Responsive & Theme Check:**
   - Toggle Light/Dark Mode and verify mobile viewport (`< 768px`) bottom navigation bar works smoothly.

---

## 8. Step 7: Day-2 Operations, Rollbacks & Troubleshooting

### Continuous Deployment & Rollback
- **Auto-Deploy:** Every push to `main` on GitHub automatically triggers a Netlify production build and deploy.
- **Instant Rollback:** In **Netlify -> Deploys**, select any previous green deploy and click **Publish deploy** to roll back immediately with zero downtime.
- **Data Safety:** Periodically click **Export Backup (.json)** in `/settings` to keep an offline snapshot of your vocabulary deck, test scores, and mistake log.

### Troubleshooting Matrix

| Symptom / Error | Root Cause | Resolution |
|---|---|---|
| `Firebase: Error (auth/unauthorized-domain)` on login | Production Netlify/custom domain is missing from Firebase Auth allowlist. | Add `<your-site>.netlify.app` under **Firebase Console -> Authentication -> Settings -> Authorized domains**. |
| `Missing or insufficient permissions` in browser console | `firestore.rules` not published, or user is not signed in. | Publish `firestore.rules` in **Firestore Database -> Rules** and confirm `users/{uid}` owner rules are active. |
| `401 Invalid or expired Firebase ID token` on `/api/ai/*` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` on Netlify does not match the Firebase project issuing the user's token. | Verify all 6 `NEXT_PUBLIC_FIREBASE_*` env vars belong to the exact same Firebase project, then redeploy Netlify. |
| `503 GEMINI_API_KEY is not configured on the server.` | `GEMINI_API_KEY` missing in Netlify env vars, or site was not redeployed after adding it. | Add `GEMINI_API_KEY` in **Netlify -> Environment variables** and trigger a **Clear cache and deploy site**. |
| `502 Failed to ... with AI service` on `/api/ai/*` | Gemini API quota/rate limit reached, invalid `GEMINI_API_KEY`, or model ID unavailable for your AI Studio key. | Verify key quota in Google AI Studio; if needed, set `GEMINI_MODEL` in Netlify env vars and redeploy. |
| Google Sign-In popup closes or is blocked on mobile | Browser popup blocker or strict third-party cookie/storage settings. | Allow popups for the Netlify domain and retry **Continue with Google**. |
