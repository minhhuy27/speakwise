export type VocabStatus = "new" | "learning" | "review" | "mastered";

export type SrsGrade = 0 | 1 | 2 | 3; // 0: Again, 1: Hard, 2: Good, 3: Easy

export type TestMode = "full_test" | "mini_or_part";

export type ToeicPartKey =
  | "part1"
  | "part2"
  | "part3"
  | "part4"
  | "part5"
  | "part6"
  | "part7";

export type ErrorCategory =
  | "vocab"
  | "grammar"
  | "listening_trap"
  | "inference"
  | "time_pressure"
  | "careless";

export type ReadinessVerdict =
  | "needs_foundation"
  | "approaching"
  | "almost_ready"
  | "exam_ready";

// Document: users/{uid}
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  targetScore: number; // 10..990, step 5 (default 750)
  targetListening?: number; // 5..495, step 5
  targetReading?: number; // 5..495, step 5
  targetExamDate: string | null; // ISO YYYY-MM-DD
  dailyNewWordsLimit: number; // default 15
  onboardingCompleted: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

// Document: users/{uid}/vocab/{vocabId}
export interface VocabCard {
  id: string;
  word: string; // Normalized lowercase trimmed key
  displayWord: string; // Original casing/phrase
  ipa: string; // e.g. "/ˈkɑːn.trækt/"
  partOfSpeech: string; // noun | verb | adj | adv | phrase | idiom
  meaningEn: string; // Clear English definition in TOEIC business context
  meaningVi: string; // Accurate Vietnamese meaning for bilingual comprehension
  exampleEn: string;
  exampleVi: string;
  audioUrl?: string; // Dictionary API MP3 URL (optional, fallback to Web Speech)
  wordFamily: string[];
  collocations: string[];
  tags: string[];
  personalNote?: string;
  sourceTestId?: string;
  sourceMistakeId?: string;
  // SM-2 SRS fields
  status: VocabStatus;
  easeFactor: number; // Initial 2.5, min 1.3
  intervalDays: number; // Initial 0
  repetitions: number; // Initial 0
  lapses: number; // Initial 0 (leech alert when >= 4)
  nextReviewAt: string; // ISO timestamp
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
  title: string;
  source: string;
  takenAt: string; // ISO YYYY-MM-DD
  durationMinutes: number;
  parts: Partial<Record<ToeicPartKey, PartScore>>;
  listeningCorrect: number; // 0..100 (for full_test)
  readingCorrect: number; // 0..100 (for full_test)
  listeningScore: number; // 5..495 (0 for mini_or_part)
  readingScore: number; // 5..495 (0 for mini_or_part)
  totalScore: number; // 10..990 (0 for mini_or_part)
  isManualScoreOverride: boolean;
  reflectionNote?: string;
  mistakeCount: number;
  createdAt: string;
  updatedAt: string;
}

// Document: users/{uid}/mistakes/{mistakeId}
export interface MistakeRecord {
  id: string;
  testId: string;
  testTitle: string;
  part: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  questionNumber?: number; // 1..200
  errorCategory: ErrorCategory;
  promptSnippet: string;
  userAnswer?: string;
  correctAnswer?: string;
  explanation?: string;
  extractedWord?: string;
  linkedVocabId?: string;
  createdAt: string;
}
