import { z } from "zod";

export const ALLOWED_PARTS_OF_SPEECH = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "phrase",
  "idiom",
] as const;

export const vocabEnrichRequestSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1, "Word is required")
    .max(120, "Word cannot exceed 120 characters"),
  contextSentence: z
    .string()
    .trim()
    .max(400, "Context sentence cannot exceed 400 characters")
    .optional(),
});

export type VocabEnrichRequest = z.infer<typeof vocabEnrichRequestSchema>;

export const vocabEnrichResponseSchema = z.object({
  displayWord: z.string().trim().min(1),
  ipa: z.string().trim().default(""),
  audioUrl: z.string().url().nullable().optional().default(null),
  partOfSpeech: z.string().trim().min(1),
  meaningEn: z.string().trim().min(1),
  meaningVi: z.string().trim().min(1),
  exampleEn: z.string().trim().min(1),
  exampleVi: z.string().trim().min(1),
  wordFamily: z.array(z.string().trim().min(1)).default([]),
  collocations: z.array(z.string().trim().min(1)).default([]),
  suggestedTags: z.array(z.string().trim().min(1)).default([]),
});

export type VocabEnrichResponse = z.infer<typeof vocabEnrichResponseSchema>;

const optionalAudioUrlSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === null) {
      return null;
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed === "" ? null : trimmed;
    }
    return val;
  },
  z
    .string()
    .trim()
    .url("Audio URL must be a valid URL")
    .nullable()
    .optional()
);

export const vocabCardFormSchema = z.object({
  displayWord: z
    .string()
    .trim()
    .min(1, "Display word is required")
    .max(120, "Display word cannot exceed 120 characters"),
  ipa: z
    .string()
    .trim()
    .max(80, "IPA cannot exceed 80 characters")
    .default(""),
  partOfSpeech: z
    .string()
    .trim()
    .min(1, "Part of speech is required")
    .max(40, "Part of speech cannot exceed 40 characters"),
  meaningEn: z
    .string()
    .trim()
    .min(1, "English meaning is required")
    .max(500, "English meaning cannot exceed 500 characters"),
  meaningVi: z
    .string()
    .trim()
    .min(1, "Vietnamese meaning is required")
    .max(500, "Vietnamese meaning cannot exceed 500 characters"),
  exampleEn: z
    .string()
    .trim()
    .max(500, "English example cannot exceed 500 characters")
    .default(""),
  exampleVi: z
    .string()
    .trim()
    .max(500, "Vietnamese example cannot exceed 500 characters")
    .default(""),
  audioUrl: optionalAudioUrlSchema,
  wordFamily: z.array(z.string().trim().min(1)).default([]),
  collocations: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
  personalNote: z
    .string()
    .trim()
    .max(500, "Personal note cannot exceed 500 characters")
    .optional(),
  sourceTestId: z.string().trim().optional(),
  sourceMistakeId: z.string().trim().optional(),
});

export type VocabCardFormValues = z.infer<typeof vocabCardFormSchema>;
