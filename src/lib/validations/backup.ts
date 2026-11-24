import { z } from "zod";
import { ERROR_CATEGORIES } from "@/lib/validations/mistake";
import { userProfileFormSchema } from "@/lib/validations/profile";
import { partScoreSchema } from "@/lib/validations/test";
import type { VocabStatus } from "@/types/domain";

export const SPEAKWISE_BACKUP_VERSION = 1 as const;

export const VOCAB_STATUSES = [
  "new",
  "learning",
  "review",
  "mastered",
] as const satisfies readonly VocabStatus[];

export const vocabCardBackupSchema = z.object({
  id: z.string().trim().min(1, "Vocabulary card id is required"),
  word: z.string().trim().min(1, "Normalized word is required"),
  displayWord: z.string().trim().min(1, "Display word is required"),
  ipa: z.string().default(""),
  partOfSpeech: z.string().trim().min(1, "Part of speech is required"),
  meaningEn: z.string().trim().min(1, "English meaning is required"),
  meaningVi: z.string().trim().min(1, "Vietnamese meaning is required"),
  exampleEn: z.string().default(""),
  exampleVi: z.string().default(""),
  audioUrl: z.string().trim().min(1).optional(),
  wordFamily: z.array(z.string()).default([]),
  collocations: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  personalNote: z.string().optional(),
  sourceTestId: z.string().optional(),
  sourceMistakeId: z.string().optional(),
  status: z.enum(VOCAB_STATUSES),
  easeFactor: z.number().finite().min(1.3),
  intervalDays: z.number().int().min(0),
  repetitions: z.number().int().min(0),
  lapses: z.number().int().min(0),
  nextReviewAt: z.string().trim().min(1, "nextReviewAt is required"),
  lastReviewedAt: z.string().trim().min(1).optional(),
  createdAt: z.string().trim().min(1, "createdAt is required"),
  updatedAt: z.string().trim().min(1, "updatedAt is required"),
});

export const testAttemptBackupSchema = z.object({
  id: z.string().trim().min(1, "Test id is required"),
  mode: z.enum(["full_test", "mini_or_part"]),
  title: z.string().trim().min(1, "Test title is required"),
  source: z.string().trim().min(1, "Test source is required"),
  takenAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "takenAt must use YYYY-MM-DD format"),
  durationMinutes: z.number().int().min(1).max(300),
  parts: z
    .object({
      part1: partScoreSchema.optional(),
      part2: partScoreSchema.optional(),
      part3: partScoreSchema.optional(),
      part4: partScoreSchema.optional(),
      part5: partScoreSchema.optional(),
      part6: partScoreSchema.optional(),
      part7: partScoreSchema.optional(),
    })
    .default({}),
  listeningCorrect: z.number().int().min(0).max(100),
  readingCorrect: z.number().int().min(0).max(100),
  listeningScore: z.number().int().min(0).max(495),
  readingScore: z.number().int().min(0).max(495),
  totalScore: z.number().int().min(0).max(990),
  isManualScoreOverride: z.boolean(),
  reflectionNote: z.string().optional(),
  mistakeCount: z.number().int().min(0),
  createdAt: z.string().trim().min(1, "createdAt is required"),
  updatedAt: z.string().trim().min(1, "updatedAt is required"),
});

export const mistakeRecordBackupSchema = z.object({
  id: z.string().trim().min(1, "Mistake id is required"),
  testId: z.string().trim().min(1, "testId is required"),
  testTitle: z.string().trim().min(1, "testTitle is required"),
  part: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
  ]),
  questionNumber: z.number().int().min(1).max(200).optional(),
  errorCategory: z.enum(ERROR_CATEGORIES),
  promptSnippet: z.string().trim().min(1, "promptSnippet is required"),
  userAnswer: z.string().optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().optional(),
  extractedWord: z.string().optional(),
  linkedVocabId: z.string().optional(),
  createdAt: z.string().trim().min(1, "createdAt is required"),
});

export const speakwiseBackupSchema = z.object({
  app: z.literal("speakwise"),
  version: z.literal(SPEAKWISE_BACKUP_VERSION),
  exportedAt: z.string().trim().min(1, "exportedAt timestamp is required"),
  profile: userProfileFormSchema.optional(),
  vocab: z.array(vocabCardBackupSchema).default([]),
  tests: z.array(testAttemptBackupSchema).default([]),
  mistakes: z.array(mistakeRecordBackupSchema).default([]),
});

export type SpeakWiseBackupPayload = z.infer<typeof speakwiseBackupSchema>;
export type VocabCardBackup = z.infer<typeof vocabCardBackupSchema>;
export type TestAttemptBackup = z.infer<typeof testAttemptBackupSchema>;
export type MistakeRecordBackup = z.infer<typeof mistakeRecordBackupSchema>;
