import { z } from "zod";

const optionalSectionScoreSchema = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) {
      return null;
    }
    if (typeof val === "number" && Number.isNaN(val)) {
      return null;
    }
    if (typeof val === "string") {
      const parsed = Number(val.trim());
      return Number.isNaN(parsed) ? val : parsed;
    }
    return val;
  },
  z
    .number({ invalid_type_error: "Score must be a valid number" })
    .int("Score must be a whole number")
    .min(5, "Section score must be at least 5")
    .max(495, "Section score cannot exceed 495")
    .refine((val) => val % 5 === 0, "Score must be a multiple of 5")
    .nullable()
    .optional()
);

const optionalExamDateSchema = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) {
      return null;
    }
    return typeof val === "string" ? val.trim() : val;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Exam date must use YYYY-MM-DD format")
    .nullable()
    .optional()
);

export const userProfileFormSchema = z.object({
  targetScore: z.coerce
    .number({ invalid_type_error: "Target score must be a valid number" })
    .int("Target score must be a whole number")
    .min(10, "Target score must be at least 10")
    .max(990, "Target score cannot exceed 990")
    .refine((val) => val % 5 === 0, "Target score must be a multiple of 5"),
  targetListening: optionalSectionScoreSchema,
  targetReading: optionalSectionScoreSchema,
  targetExamDate: optionalExamDateSchema,
  dailyNewWordsLimit: z.coerce
    .number({ invalid_type_error: "Daily limit must be a valid number" })
    .int("Daily limit must be a whole number")
    .min(5, "Daily new words limit must be at least 5")
    .max(50, "Daily new words limit cannot exceed 50"),
});

export type UserProfileFormValues = z.infer<typeof userProfileFormSchema>;
