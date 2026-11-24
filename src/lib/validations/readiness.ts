import { z } from "zod";
import { ERROR_CATEGORIES } from "@/lib/validations/mistake";
import type { ReadinessVerdict } from "@/types/domain";

export const READINESS_VERDICTS = [
  "needs_foundation",
  "approaching",
  "almost_ready",
  "exam_ready",
] as const satisfies readonly ReadinessVerdict[];

export const READINESS_VERDICT_LABELS: Record<ReadinessVerdict, string> = {
  needs_foundation: "Needs Foundation",
  approaching: "Approaching",
  almost_ready: "Almost Ready",
  exam_ready: "Exam Ready",
};

const TOEIC_PART_ENUM = z.enum([
  "part1",
  "part2",
  "part3",
  "part4",
  "part5",
  "part6",
  "part7",
]);

function rejectEmptyOrBooleanBeforeCoerce(val: unknown): unknown {
  if (val === null || val === undefined || typeof val === "boolean") {
    return undefined;
  }
  if (typeof val === "string" && val.trim() === "") {
    return undefined;
  }
  return val;
}

const recentFullTestSummarySchema = z.object({
  title: z.string().trim().min(1, "Test title is required"),
  takenAt: z.string().trim(),
  listeningScore: z
    .number()
    .min(0, "Listening score cannot be negative")
    .max(495, "Listening score cannot exceed 495"),
  readingScore: z
    .number()
    .min(0, "Reading score cannot be negative")
    .max(495, "Reading score cannot exceed 495"),
  totalScore: z
    .number()
    .min(0, "Total score cannot be negative")
    .max(990, "Total score cannot exceed 990"),
  durationMinutes: z.number().min(0, "Duration cannot be negative"),
});

const errorCategoryCountSchema = z.object({
  category: z.enum(ERROR_CATEGORIES),
  count: z.number().int().min(0),
});

const vocabStatsSchema = z.object({
  total: z.number().int().min(0),
  mastered: z.number().int().min(0),
  dueToday: z.number().int().min(0),
  leechCount: z.number().int().min(0).optional(),
});

export const readinessInsightRequestSchema = z.object({
  targetScore: z.preprocess(
    rejectEmptyOrBooleanBeforeCoerce,
    z.coerce
      .number({ invalid_type_error: "Target score must be a valid number" })
      .int("Target score must be a whole number")
      .min(10, "Target score must be at least 10")
      .max(990, "Target score cannot exceed 990")
  ),
  targetExamDate: z.string().trim().nullable().optional(),
  readinessScore: z.preprocess(
    rejectEmptyOrBooleanBeforeCoerce,
    z.coerce
      .number({ invalid_type_error: "Readiness score must be a valid number" })
      .min(0, "Readiness score must be at least 0")
      .max(100, "Readiness score cannot exceed 100")
  ),
  verdict: z.enum(READINESS_VERDICTS),
  recentFullTests: z
    .array(recentFullTestSummarySchema)
    .max(10, "At most 10 recent full tests may be provided"),
  partAccuracy: z.record(
    TOEIC_PART_ENUM,
    z
      .number()
      .min(0, "Part accuracy must be between 0 and 1")
      .max(1, "Part accuracy must be between 0 and 1")
      .nullable()
      .optional()
  ),
  topErrorCategories: z.array(errorCategoryCountSchema).default([]),
  vocabStats: vocabStatsSchema,
});

export type ReadinessInsightRequest = z.infer<
  typeof readinessInsightRequestSchema
>;

export const readinessInsightResponseSchema = z.object({
  examDecision: z.string().trim().min(1, "Exam decision is required"),
  strengths: z
    .array(z.string().trim().min(1))
    .min(1, "At least one strength is required")
    .max(5, "At most 5 strengths may be returned"),
  criticalGaps: z
    .array(z.string().trim().min(1))
    .min(1, "At least one critical gap is required")
    .max(5, "At most 5 critical gaps may be returned"),
  twoWeekActionPlan: z
    .array(z.string().trim().min(1))
    .min(1, "At least one action item is required")
    .max(6, "At most 6 action items may be returned"),
});

export type ReadinessInsightResponse = z.infer<
  typeof readinessInsightResponseSchema
>;
