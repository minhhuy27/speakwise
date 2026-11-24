import { describe, expect, it } from "vitest";
import { userProfileFormSchema } from "@/lib/validations/profile";

describe("userProfileFormSchema", () => {
  it("accepts a valid full profile payload", () => {
    const result = userProfileFormSchema.safeParse({
      targetScore: 850,
      targetListening: 440,
      targetReading: 410,
      targetExamDate: "2026-12-20",
      dailyNewWordsLimit: 20,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        targetScore: 850,
        targetListening: 440,
        targetReading: 410,
        targetExamDate: "2026-12-20",
        dailyNewWordsLimit: 20,
      });
    }
  });

  it("enforces targetScore bounds (10..990) and 5-point increments", () => {
    expect(
      userProfileFormSchema.safeParse({
        targetScore: 10,
        dailyNewWordsLimit: 15,
      }).success
    ).toBe(true);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 990,
        dailyNewWordsLimit: 15,
      }).success
    ).toBe(true);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 5,
        dailyNewWordsLimit: 15,
      }).success
    ).toBe(false);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 995,
        dailyNewWordsLimit: 15,
      }).success
    ).toBe(false);

    const nonMultipleResult = userProfileFormSchema.safeParse({
      targetScore: 753,
      dailyNewWordsLimit: 15,
    });
    expect(nonMultipleResult.success).toBe(false);
    if (!nonMultipleResult.success) {
      expect(nonMultipleResult.error.flatten().fieldErrors.targetScore).toContain(
        "Target score must be a multiple of 5"
      );
    }
  });

  it("handles optional section scores cleanly", () => {
    const emptyStringsResult = userProfileFormSchema.safeParse({
      targetScore: 750,
      targetListening: "",
      targetReading: "",
      dailyNewWordsLimit: 15,
    });
    expect(emptyStringsResult.success).toBe(true);
    if (emptyStringsResult.success) {
      expect(emptyStringsResult.data.targetListening).toBeNull();
      expect(emptyStringsResult.data.targetReading).toBeNull();
    }

    const nullResult = userProfileFormSchema.safeParse({
      targetScore: 750,
      targetListening: null,
      targetReading: null,
      dailyNewWordsLimit: 15,
    });
    expect(nullResult.success).toBe(true);

    const validSectionResult = userProfileFormSchema.safeParse({
      targetScore: 750,
      targetListening: 400,
      targetReading: 350,
      dailyNewWordsLimit: 15,
    });
    expect(validSectionResult.success).toBe(true);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 750,
        targetListening: 402,
        dailyNewWordsLimit: 15,
      }).success
    ).toBe(false);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 750,
        targetReading: 500,
        dailyNewWordsLimit: 15,
      }).success
    ).toBe(false);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 750,
        targetListening: 0,
        dailyNewWordsLimit: 15,
      }).success
    ).toBe(false);
  });

  it("enforces dailyNewWordsLimit bounds (5..50)", () => {
    expect(
      userProfileFormSchema.safeParse({
        targetScore: 750,
        dailyNewWordsLimit: 5,
      }).success
    ).toBe(true);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 750,
        dailyNewWordsLimit: 50,
      }).success
    ).toBe(true);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 750,
        dailyNewWordsLimit: 4,
      }).success
    ).toBe(false);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 750,
        dailyNewWordsLimit: 51,
      }).success
    ).toBe(false);
  });

  it("validates targetExamDate as YYYY-MM-DD or empty/null", () => {
    const emptyDate = userProfileFormSchema.safeParse({
      targetScore: 750,
      targetExamDate: "",
      dailyNewWordsLimit: 15,
    });
    expect(emptyDate.success).toBe(true);
    if (emptyDate.success) {
      expect(emptyDate.data.targetExamDate).toBeNull();
    }

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 750,
        targetExamDate: "2026-11-30",
        dailyNewWordsLimit: 15,
      }).success
    ).toBe(true);

    expect(
      userProfileFormSchema.safeParse({
        targetScore: 750,
        targetExamDate: "30-11-2026",
        dailyNewWordsLimit: 15,
      }).success
    ).toBe(false);
  });
});
