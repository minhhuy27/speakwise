import { z } from "zod";
import type { ErrorCategory } from "@/types/domain";

export const ERROR_CATEGORIES = [
  "vocab",
  "grammar",
  "listening_trap",
  "inference",
  "time_pressure",
  "careless",
] as const satisfies readonly ErrorCategory[];

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  vocab: "Vocabulary",
  grammar: "Grammar",
  listening_trap: "Listening Trap",
  inference: "Inference",
  time_pressure: "Time Pressure",
  careless: "Careless",
};

const optionalQuestionNumberSchema = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) {
      return undefined;
    }
    if (typeof val === "number" && Number.isNaN(val)) {
      return undefined;
    }
    if (typeof val === "string" && val.trim() === "") {
      return undefined;
    }
    return val;
  },
  z.coerce
    .number({ invalid_type_error: "Question must be 1–200" })
    .int("Question must be a whole number")
    .min(1, "Question must be 1–200")
    .max(200, "Question must be 1–200")
    .optional()
);

export const mistakeFormSchema = z.object({
  part: z.coerce
    .number({ invalid_type_error: "TOEIC part must be a valid number" })
    .int("TOEIC part must be a whole number")
    .min(1, "TOEIC part must be between 1 and 7")
    .max(7, "TOEIC part must be between 1 and 7"),
  questionNumber: optionalQuestionNumberSchema,
  errorCategory: z.enum(ERROR_CATEGORIES),
  promptSnippet: z
    .string()
    .trim()
    .min(1, "Question or trap summary is required")
    .max(600, "Question or trap summary cannot exceed 600 characters"),
  userAnswer: z
    .string()
    .trim()
    .max(200, "Your answer cannot exceed 200 characters")
    .optional(),
  correctAnswer: z
    .string()
    .trim()
    .max(200, "Correct answer cannot exceed 200 characters")
    .optional(),
  explanation: z
    .string()
    .trim()
    .max(1200, "Explanation cannot exceed 1200 characters")
    .optional(),
  extractedWord: z
    .string()
    .trim()
    .max(120, "Extracted word cannot exceed 120 characters")
    .optional(),
});

export type MistakeFormValues = z.infer<typeof mistakeFormSchema>;

export const mistakeExplainRequestSchema = z.object({
  part: z.coerce
    .number({ invalid_type_error: "TOEIC part must be a valid number" })
    .int("TOEIC part must be a whole number")
    .min(1, "TOEIC part must be between 1 and 7")
    .max(7, "TOEIC part must be between 1 and 7"),
  promptSnippet: z
    .string()
    .trim()
    .min(1, "Question or trap summary is required")
    .max(600, "Question or trap summary cannot exceed 600 characters"),
  userAnswer: z
    .string()
    .trim()
    .max(200, "Your answer cannot exceed 200 characters")
    .optional(),
  correctAnswer: z
    .string()
    .trim()
    .max(200, "Correct answer cannot exceed 200 characters")
    .optional(),
  errorCategory: z.enum(ERROR_CATEGORIES),
});

export type MistakeExplainRequest = z.infer<typeof mistakeExplainRequestSchema>;

export const mistakeExplainResponseSchema = z.object({
  explanation: z.string().trim().min(1),
  toeicTip: z.string().trim().min(1),
  keyVocabulary: z.array(z.string().trim().min(1)).default([]),
});

export type MistakeExplainResponse = z.infer<
  typeof mistakeExplainResponseSchema
>;
