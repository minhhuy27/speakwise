import { describe, expect, it } from "vitest";
import {
  READINESS_VERDICT_LABELS,
  READINESS_VERDICTS,
  readinessInsightRequestSchema,
  readinessInsightResponseSchema,
} from "@/lib/validations/readiness";

function buildValidRequestPayload() {
  return {
    targetScore: 850,
    targetExamDate: "2026-12-15",
    readinessScore: 79.5,
    verdict: "almost_ready" as const,
    recentFullTests: [
      {
        title: "ETS TOEIC 2024 Test 1",
        takenAt: "2026-11-10",
        listeningScore: 425,
        readingScore: 370,
        totalScore: 795,
        durationMinutes: 122,
      },
      {
        title: "ETS TOEIC 2024 Test 2",
        takenAt: "2026-11-18",
        listeningScore: 440,
        readingScore: 385,
        totalScore: 825,
        durationMinutes: 118,
      },
    ],
    partAccuracy: {
      part1: 0.92,
      part2: 0.84,
      part3: 0.85,
      part4: 0.82,
      part5: 0.8,
      part6: 0.75,
      part7: 0.68,
    },
    topErrorCategories: [
      { category: "time_pressure" as const, count: 14 },
      { category: "inference" as const, count: 9 },
    ],
    vocabStats: {
      total: 320,
      mastered: 210,
      dueToday: 18,
      leechCount: 4,
    },
  };
}

describe("readiness verdict constants", () => {
  it("exports all 4 readiness verdicts and English labels", () => {
    expect(READINESS_VERDICTS).toEqual([
      "needs_foundation",
      "approaching",
      "almost_ready",
      "exam_ready",
    ]);
    expect(READINESS_VERDICT_LABELS).toEqual({
      needs_foundation: "Needs Foundation",
      approaching: "Approaching",
      almost_ready: "Almost Ready",
      exam_ready: "Exam Ready",
    });
  });
});

describe("readinessInsightRequestSchema", () => {
  it("accepts a complete valid request payload and coerces numeric strings", () => {
    const result = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      targetScore: "850",
      targetExamDate: "  2026-12-15  ",
      readinessScore: "81.5",
      recentFullTests: [
        {
          title: "  ETS TOEIC 2024 Test 3  ",
          takenAt: " 2026-11-22 ",
          listeningScore: 445,
          readingScore: 390,
          totalScore: 835,
          durationMinutes: 119,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetScore).toBe(850);
      expect(result.data.targetExamDate).toBe("2026-12-15");
      expect(result.data.readinessScore).toBe(81.5);
      expect(result.data.recentFullTests[0].title).toBe("ETS TOEIC 2024 Test 3");
      expect(result.data.recentFullTests[0].takenAt).toBe("2026-11-22");
    }
  });

  it("supports nullable targetExamDate, partial partAccuracy, omitted leechCount, and defaults topErrorCategories", () => {
    const payload = buildValidRequestPayload();
    const { topErrorCategories: _omittedErrors, ...withoutErrors } = payload;
    void _omittedErrors;

    const result = readinessInsightRequestSchema.safeParse({
      ...withoutErrors,
      targetExamDate: null,
      partAccuracy: {
        part1: 0.88,
        part5: null,
        part7: undefined,
      },
      vocabStats: {
        total: 120,
        mastered: 45,
        dueToday: 12,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetExamDate).toBeNull();
      expect(result.data.topErrorCategories).toEqual([]);
      expect(result.data.partAccuracy.part1).toBe(0.88);
      expect(result.data.partAccuracy.part5).toBeNull();
      expect(result.data.vocabStats.leechCount).toBeUndefined();
    }
  });

  it("rejects out-of-range scores, empty readinessScore, invalid verdict, and unknown part keys", () => {
    const invalidTarget = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      targetScore: 995,
    });
    expect(invalidTarget.success).toBe(false);

    const lowTarget = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      targetScore: 5,
    });
    expect(lowTarget.success).toBe(false);

    const invalidReadiness = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      readinessScore: 105,
    });
    expect(invalidReadiness.success).toBe(false);

    const emptyReadiness = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      readinessScore: "",
    });
    expect(emptyReadiness.success).toBe(false);

    const invalidVerdict = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      verdict: "ready_now",
    });
    expect(invalidVerdict.success).toBe(false);

    const invalidPartKey = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      partAccuracy: {
        part8: 0.9,
      },
    });
    expect(invalidPartKey.success).toBe(false);

    const invalidPartAccuracyValue = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      partAccuracy: {
        part7: 1.2,
      },
    });
    expect(invalidPartAccuracyValue.success).toBe(false);
  });

  it("rejects more than 10 recent full tests, invalid test bounds, invalid error categories, and negative vocabStats", () => {
    const tooManyTests = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      recentFullTests: Array.from({ length: 11 }, (_, idx) => ({
        title: `Test ${idx + 1}`,
        takenAt: "2026-11-01",
        listeningScore: 400,
        readingScore: 350,
        totalScore: 750,
        durationMinutes: 120,
      })),
    });
    expect(tooManyTests.success).toBe(false);

    const invalidListeningScore = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      recentFullTests: [
        {
          title: "ETS Test",
          takenAt: "2026-11-12",
          listeningScore: 500,
          readingScore: 400,
          totalScore: 900,
          durationMinutes: 120,
        },
      ],
    });
    expect(invalidListeningScore.success).toBe(false);

    const invalidErrorCategory = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      topErrorCategories: [{ category: "unknown_trap", count: 3 }],
    });
    expect(invalidErrorCategory.success).toBe(false);

    const negativeVocab = readinessInsightRequestSchema.safeParse({
      ...buildValidRequestPayload(),
      vocabStats: {
        total: 100,
        mastered: -1,
        dueToday: 5,
      },
    });
    expect(negativeVocab.success).toBe(false);
  });
});

describe("readinessInsightResponseSchema", () => {
  it("accepts a valid English readiness strategy payload and trims fields", () => {
    const result = readinessInsightResponseSchema.safeParse({
      examDecision:
        "  Wait 2 weeks before sitting the official exam while stabilizing Reading pacing under 120 minutes.  ",
      strengths: [
        "  Strong Listening consistency at 425-440/495 across recent full tests.  ",
        "High Part 1 accuracy (92%) and 66% SRS vocabulary mastery.",
      ],
      criticalGaps: [
        "Part 7 accuracy trails at 68% with 14 time-pressure mistakes.",
      ],
      twoWeekActionPlan: [
        "Complete 3 timed Part 7 multi-passage sets every other day targeting 50 minutes total.",
        "Cap Part 5 at 10 minutes and Part 6 at 8 minutes per full Reading drill.",
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.examDecision).toBe(
        "Wait 2 weeks before sitting the official exam while stabilizing Reading pacing under 120 minutes."
      );
      expect(result.data.strengths[0]).toBe(
        "Strong Listening consistency at 425-440/495 across recent full tests."
      );
    }
  });

  it("rejects empty strings, empty arrays, and oversized arrays", () => {
    const blankDecision = readinessInsightResponseSchema.safeParse({
      examDecision: "   ",
      strengths: ["Consistent Listening score"],
      criticalGaps: ["Part 7 speed"],
      twoWeekActionPlan: ["Drill Part 7 daily"],
    });
    expect(blankDecision.success).toBe(false);

    const emptyGaps = readinessInsightResponseSchema.safeParse({
      examDecision: "Schedule the exam this month.",
      strengths: ["Consistent Listening score"],
      criticalGaps: [],
      twoWeekActionPlan: ["Maintain daily SRS reviews"],
    });
    expect(emptyGaps.success).toBe(false);

    const tooManyActions = readinessInsightResponseSchema.safeParse({
      examDecision: "Schedule the exam this month.",
      strengths: ["Consistent Listening score"],
      criticalGaps: ["Part 7 speed"],
      twoWeekActionPlan: ["1", "2", "3", "4", "5", "6", "7"],
    });
    expect(tooManyActions.success).toBe(false);
  });
});
