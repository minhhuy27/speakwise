import { describe, expect, it } from "vitest";
import { PART_MAX_QUESTIONS } from "@/lib/engines/score-converter";
import {
  ERROR_CATEGORIES,
  ERROR_CATEGORY_LABELS,
  mistakeExplainRequestSchema,
  mistakeExplainResponseSchema,
  mistakeFormSchema,
} from "@/lib/validations/mistake";
import {
  partScoreSchema,
  testAttemptFormSchema,
  TOEIC_PART_KEYS,
} from "@/lib/validations/test";

function buildFullTestParts() {
  return {
    part1: { correct: 5, total: PART_MAX_QUESTIONS.part1 },
    part2: { correct: 21, total: PART_MAX_QUESTIONS.part2 },
    part3: { correct: 32, total: PART_MAX_QUESTIONS.part3 },
    part4: { correct: 24, total: PART_MAX_QUESTIONS.part4 },
    part5: { correct: 25, total: PART_MAX_QUESTIONS.part5 },
    part6: { correct: 13, total: PART_MAX_QUESTIONS.part6 },
    part7: { correct: 45, total: PART_MAX_QUESTIONS.part7 },
  };
}

describe("partScoreSchema", () => {
  it("accepts valid counts and rejects correct exceeding total", () => {
    const valid = partScoreSchema.safeParse({ correct: "5", total: "6" });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data).toEqual({ correct: 5, total: 6 });
    }

    const invalid = partScoreSchema.safeParse({ correct: 7, total: 6 });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.flatten().fieldErrors.correct).toContain(
        "Correct count cannot exceed total questions"
      );
    }
  });
});

describe("testAttemptFormSchema", () => {
  it("accepts a valid full_test attempt with all 7 standard parts", () => {
    const result = testAttemptFormSchema.safeParse({
      mode: "full_test",
      title: "  ETS TOEIC 2024 Test 1  ",
      source: "  ETS 2024  ",
      takenAt: "2026-11-20",
      durationMinutes: "120",
      parts: buildFullTestParts(),
      isManualScoreOverride: false,
      manualListeningScore: "",
      manualReadingScore: null,
      reflectionNote: "  Rushed on final double passage.  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("ETS TOEIC 2024 Test 1");
      expect(result.data.source).toBe("ETS 2024");
      expect(result.data.durationMinutes).toBe(120);
      expect(result.data.manualListeningScore).toBeNull();
      expect(result.data.manualReadingScore).toBeNull();
      expect(result.data.reflectionNote).toBe(
        "Rushed on final double passage."
      );
    }
  });

  it("rejects full_test when any of the 7 parts is missing", () => {
    const { part7: _omitted, ...incompleteParts } = buildFullTestParts();
    void _omitted;

    const result = testAttemptFormSchema.safeParse({
      mode: "full_test",
      title: "ETS 2024 Test 2",
      source: "ETS 2024",
      takenAt: "2026-11-20",
      durationMinutes: 120,
      parts: incompleteParts,
      isManualScoreOverride: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.join(".") === "parts.part7" &&
            issue.message.includes("PART7 score is required")
        )
      ).toBe(true);
    }
  });

  it("rejects full_test when a part total does not match PART_MAX_QUESTIONS", () => {
    const parts = buildFullTestParts();
    parts.part1 = { correct: 5, total: 10 };

    const result = testAttemptFormSchema.safeParse({
      mode: "full_test",
      title: "ETS 2024 Test 3",
      source: "ETS 2024",
      takenAt: "2026-11-20",
      durationMinutes: 120,
      parts,
      isManualScoreOverride: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.join(".") === "parts.part1.total" &&
            issue.message.includes("exactly 6 questions")
        )
      ).toBe(true);
    }
  });

  it("requires valid manual scores when isManualScoreOverride is true on full_test", () => {
    const missingManual = testAttemptFormSchema.safeParse({
      mode: "full_test",
      title: "ETS 2024 Test 4",
      source: "ETS 2024",
      takenAt: "2026-11-20",
      durationMinutes: 120,
      parts: buildFullTestParts(),
      isManualScoreOverride: true,
      manualListeningScore: "",
      manualReadingScore: undefined,
    });

    expect(missingManual.success).toBe(false);
    if (!missingManual.success) {
      const flattened = missingManual.error.flatten();
      expect(flattened.fieldErrors.manualListeningScore).toBeDefined();
      expect(flattened.fieldErrors.manualReadingScore).toBeDefined();
    }

    const nonMultipleOfFive = testAttemptFormSchema.safeParse({
      mode: "full_test",
      title: "ETS 2024 Test 4",
      source: "ETS 2024",
      takenAt: "2026-11-20",
      durationMinutes: 120,
      parts: buildFullTestParts(),
      isManualScoreOverride: true,
      manualListeningScore: 452,
      manualReadingScore: 410,
    });

    expect(nonMultipleOfFive.success).toBe(false);
    if (!nonMultipleOfFive.success) {
      expect(
        nonMultipleOfFive.error.flatten().fieldErrors.manualListeningScore
      ).toContain("Score must be a multiple of 5");
    }

    const validOverride = testAttemptFormSchema.safeParse({
      mode: "full_test",
      title: "ETS 2024 Test 4",
      source: "ETS 2024",
      takenAt: "2026-11-20",
      durationMinutes: 120,
      parts: buildFullTestParts(),
      isManualScoreOverride: true,
      manualListeningScore: "450",
      manualReadingScore: 415,
    });

    expect(validOverride.success).toBe(true);
    if (validOverride.success) {
      expect(validOverride.data.manualListeningScore).toBe(450);
      expect(validOverride.data.manualReadingScore).toBe(415);
    }
  });

  it("accepts valid mini_or_part attempt and rejects empty mini_or_part", () => {
    expect(TOEIC_PART_KEYS).toHaveLength(7);

    const validMini = testAttemptFormSchema.safeParse({
      mode: "mini_or_part",
      title: "Part 5 Grammar Sprint",
      source: "Hackers 1000",
      takenAt: "2026-11-21",
      durationMinutes: 15,
      parts: {
        part5: { correct: 24, total: 30 },
      },
    });

    expect(validMini.success).toBe(true);

    const emptyMini = testAttemptFormSchema.safeParse({
      mode: "mini_or_part",
      title: "Empty Mini Test",
      source: "Self Study",
      takenAt: "2026-11-21",
      durationMinutes: 15,
      parts: {},
    });

    expect(emptyMini.success).toBe(false);
    if (!emptyMini.success) {
      expect(
        emptyMini.error.issues.some(
          (issue) =>
            issue.path.join(".") === "parts" &&
            issue.message === "At least one TOEIC part score is required"
        )
      ).toBe(true);
    }
  });

  it("rejects part entries where correct exceeds total", () => {
    const result = testAttemptFormSchema.safeParse({
      mode: "mini_or_part",
      title: "Part 6 Drill",
      source: "Economy RC",
      takenAt: "2026-11-21",
      durationMinutes: 12,
      parts: {
        part6: { correct: 18, total: 16 },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.join(".") === "parts.part6.correct" &&
            issue.message === "Correct count cannot exceed total questions"
        )
      ).toBe(true);
    }
  });

  it("normalizes NaN scaled scores to null when override is disabled", () => {
    const result = testAttemptFormSchema.safeParse({
      mode: "mini_or_part",
      title: "Part 2 Listening Practice",
      source: "ETS 2023",
      takenAt: "2026-11-22",
      durationMinutes: 10,
      parts: {
        part2: { correct: 22, total: 25 },
      },
      isManualScoreOverride: false,
      manualListeningScore: Number.NaN,
      manualReadingScore: undefined,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manualListeningScore).toBeNull();
      expect(result.data.manualReadingScore).toBeNull();
    }
  });
});

describe("mistakeFormSchema and AI explain schemas", () => {
  it("exports all 6 TOEIC error categories with English labels", () => {
    expect(ERROR_CATEGORIES).toEqual([
      "vocab",
      "grammar",
      "listening_trap",
      "inference",
      "time_pressure",
      "careless",
    ]);
    expect(ERROR_CATEGORY_LABELS.listening_trap).toBe("Listening Trap");
  });

  it("accepts a valid mistake record and coerces numeric strings", () => {
    const result = mistakeFormSchema.safeParse({
      part: "5",
      questionNumber: "118",
      errorCategory: "grammar",
      promptSnippet:
        "  The revised contract must be signed _____ Friday afternoon.  ",
      userAnswer: "  until ",
      correctAnswer: "  by ",
      explanation: "  Use 'by' for a deadline rather than 'until'.  ",
      extractedWord: "  revised  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        part: 5,
        questionNumber: 118,
        errorCategory: "grammar",
        promptSnippet:
          "The revised contract must be signed _____ Friday afternoon.",
        userAnswer: "until",
        correctAnswer: "by",
        explanation: "Use 'by' for a deadline rather than 'until'.",
        extractedWord: "revised",
      });
    }
  });

  it("preprocesses empty, null, undefined, or NaN questionNumber to undefined and enforces 1–200 bounds", () => {
    for (const emptyValue of ["", null, undefined, Number.NaN]) {
      const parsed = mistakeFormSchema.safeParse({
        part: 2,
        questionNumber: emptyValue,
        errorCategory: "listening_trap",
        promptSnippet: "Similar-sounding distractor: copy vs. coffee",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.questionNumber).toBeUndefined();
      }
    }

    const outOfRange = mistakeFormSchema.safeParse({
      part: 7,
      questionNumber: 205,
      errorCategory: "inference",
      promptSnippet: "Missed implied announcement date in memo",
    });
    expect(outOfRange.success).toBe(false);
    if (!outOfRange.success) {
      expect(
        outOfRange.error.flatten().fieldErrors.questionNumber
      ).toContain("Question must be 1–200");
    }
  });

  it("rejects out-of-range part, invalid category, and blank promptSnippet", () => {
    const result = mistakeFormSchema.safeParse({
      part: 8,
      errorCategory: "unknown_category",
      promptSnippet: "   ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.part).toBeDefined();
      expect(fields.errorCategory).toBeDefined();
      expect(fields.promptSnippet).toContain(
        "Question or trap summary is required"
      );
    }
  });

  it("validates mistakeExplainRequestSchema and mistakeExplainResponseSchema", () => {
    const reqResult = mistakeExplainRequestSchema.safeParse({
      part: 5,
      promptSnippet: "Despite _____ the budget cuts, sales grew by 12%.",
      userAnswer: "although",
      correctAnswer: "of",
      errorCategory: "grammar",
    });
    expect(reqResult.success).toBe(true);

    const resResult = mistakeExplainResponseSchema.safeParse({
      explanation:
        "Use 'despite' without 'of', or 'in spite of' before a noun phrase.",
      toeicTip:
        "Check whether the blank precedes a clause (although) or a noun phrase (despite).",
    });
    expect(resResult.success).toBe(true);
    if (resResult.success) {
      expect(resResult.data.keyVocabulary).toEqual([]);
    }
  });
});
