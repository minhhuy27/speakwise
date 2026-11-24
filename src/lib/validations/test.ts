import { z } from "zod";
import { PART_MAX_QUESTIONS } from "@/lib/engines/score-converter";
import type { ToeicPartKey } from "@/types/domain";

export const TOEIC_PART_KEYS = [
  "part1",
  "part2",
  "part3",
  "part4",
  "part5",
  "part6",
  "part7",
] as const satisfies readonly ToeicPartKey[];

export const partScoreSchema = z
  .object({
    correct: z.coerce
      .number({ invalid_type_error: "Correct count must be a valid number" })
      .int("Correct count must be a whole number")
      .min(0, "Correct count cannot be negative"),
    total: z.coerce
      .number({ invalid_type_error: "Total must be a valid number" })
      .int("Total must be a whole number")
      .min(1, "Total must be at least 1")
      .max(200, "Total cannot exceed 200"),
  })
  .refine((v) => v.correct <= v.total, {
    message: "Correct count cannot exceed total questions",
    path: ["correct"],
  });

const optionalScaledScoreSchema = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) {
      return null;
    }
    if (typeof val === "number" && Number.isNaN(val)) {
      return null;
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "") {
        return null;
      }
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? val : parsed;
    }
    return val;
  },
  z
    .number({ invalid_type_error: "Score must be a valid number" })
    .int("Score must be a whole number")
    .min(5, "Score must be at least 5")
    .max(495, "Score cannot exceed 495")
    .refine((v) => v % 5 === 0, "Score must be a multiple of 5")
    .nullable()
    .optional()
);

export const testAttemptFormSchema = z
  .object({
    mode: z.enum(["full_test", "mini_or_part"]),
    title: z
      .string()
      .trim()
      .min(1, "Test title is required")
      .max(140, "Test title cannot exceed 140 characters"),
    source: z
      .string()
      .trim()
      .min(1, "Source is required")
      .max(80, "Source cannot exceed 80 characters"),
    takenAt: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format"),
    durationMinutes: z.coerce
      .number({ invalid_type_error: "Duration must be a valid number" })
      .int("Duration must be a whole number")
      .min(1, "Duration must be at least 1 minute")
      .max(300, "Duration cannot exceed 300 minutes"),
    parts: z.object({
      part1: partScoreSchema.optional(),
      part2: partScoreSchema.optional(),
      part3: partScoreSchema.optional(),
      part4: partScoreSchema.optional(),
      part5: partScoreSchema.optional(),
      part6: partScoreSchema.optional(),
      part7: partScoreSchema.optional(),
    }),
    isManualScoreOverride: z.boolean().default(false),
    manualListeningScore: optionalScaledScoreSchema,
    manualReadingScore: optionalScaledScoreSchema,
    reflectionNote: z
      .string()
      .trim()
      .max(1000, "Reflection note cannot exceed 1000 characters")
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === "full_test") {
      for (const part of TOEIC_PART_KEYS) {
        const partScore = val.parts[part];
        const expectedMax = PART_MAX_QUESTIONS[part];

        if (!partScore) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["parts", part],
            message: `${part.toUpperCase()} score is required for a full test`,
          });
          continue;
        }

        if (partScore.total !== expectedMax) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["parts", part, "total"],
            message: `${part.toUpperCase()} must have exactly ${expectedMax} questions in a full test`,
          });
        }

        if (partScore.correct < 0 || partScore.correct > expectedMax) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["parts", part, "correct"],
            message: `${part.toUpperCase()} correct count must be between 0 and ${expectedMax}`,
          });
        }
      }

      if (val.isManualScoreOverride) {
        if (val.manualListeningScore == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["manualListeningScore"],
            message:
              "Manual Listening score is required when score override is enabled",
          });
        }
        if (val.manualReadingScore == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["manualReadingScore"],
            message:
              "Manual Reading score is required when score override is enabled",
          });
        }
      }
    }

    if (val.mode === "mini_or_part") {
      const hasAnyPart = TOEIC_PART_KEYS.some(
        (part) => val.parts[part] !== undefined
      );
      if (!hasAnyPart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parts"],
          message: "At least one TOEIC part score is required",
        });
      }
    }
  });

export type TestAttemptFormValues = z.infer<typeof testAttemptFormSchema>;
