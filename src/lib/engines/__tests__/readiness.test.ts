import { describe, expect, it } from "vitest";
import {
  computePartAccuracies,
  evaluateExamReadiness,
  mapReadinessVerdict,
} from "@/lib/engines/readiness";
import type { TestAttempt } from "@/types/domain";

const NOW = new Date(2026, 10, 24, 12, 0, 0);

function makeTestAttempt(overrides: Partial<TestAttempt> = {}): TestAttempt {
  return {
    id: "test-1",
    mode: "full_test",
    title: "ETS Test 1",
    source: "ETS 2024",
    takenAt: "2026-11-10",
    durationMinutes: 120,
    parts: {},
    listeningCorrect: 80,
    readingCorrect: 75,
    listeningScore: 415,
    readingScore: 360,
    totalScore: 775,
    isManualScoreOverride: false,
    mistakeCount: 0,
    createdAt: "2026-11-10T10:00:00.000Z",
    updatedAt: "2026-11-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("Exam Readiness Engine", () => {
  describe("mapReadinessVerdict", () => {
    it("maps threshold boundaries to the 4 verdict tiers", () => {
      expect(mapReadinessVerdict(0)).toBe("needs_foundation");
      expect(mapReadinessVerdict(49)).toBe("needs_foundation");
      expect(mapReadinessVerdict(50)).toBe("approaching");
      expect(mapReadinessVerdict(74)).toBe("approaching");
      expect(mapReadinessVerdict(75)).toBe("almost_ready");
      expect(mapReadinessVerdict(87)).toBe("almost_ready");
      expect(mapReadinessVerdict(88)).toBe("exam_ready");
      expect(mapReadinessVerdict(100)).toBe("exam_ready");
    });
  });

  describe("computePartAccuracies", () => {
    it("aggregates part accuracies across full_test and mini_or_part attempts and ranks weak parts", () => {
      const tests: TestAttempt[] = [
        makeTestAttempt({
          id: "full-1",
          mode: "full_test",
          parts: {
            part1: { correct: 5, total: 6 },
            part2: { correct: 15, total: 25 }, // 0.60
            part5: { correct: 18, total: 30 }, // 0.60
            part7: { correct: 27, total: 54 }, // 0.50
          },
        }),
        makeTestAttempt({
          id: "mini-1",
          mode: "mini_or_part",
          totalScore: 0,
          parts: {
            part1: { correct: 4, total: 6 }, // combined: 9/12 = 0.75
            part3: { correct: 2, total: 3 }, // 0.6667
            part6: { correct: 15, total: 16 }, // 0.9375
          },
        }),
      ];

      // targetScore = 750 -> targetAccuracy = 750/990 = 0.7575..., threshold = 0.7275...
      const { partAccuracies, weakParts } = computePartAccuracies(tests, 750);

      expect(partAccuracies.part1).toEqual({
        part: "part1",
        correct: 9,
        total: 12,
        accuracy: 0.75,
      });
      expect(partAccuracies.part3.accuracy).toBe(0.6667);
      expect(partAccuracies.part4).toEqual({
        part: "part4",
        correct: 0,
        total: 0,
        accuracy: null,
      });
      expect(partAccuracies.part6.accuracy).toBe(0.9375);

      // Weakest first, tie-break by canonical part order (part2 before part5)
      expect(weakParts).toEqual(["part7", "part2", "part5", "part3"]);
    });

    it("applies the 0.60 minimum accuracy floor even for low targetScore", () => {
      const tests: TestAttempt[] = [
        makeTestAttempt({
          parts: {
            part4: { correct: 17, total: 30 }, // 0.5667 < 0.60
            part5: { correct: 18, total: 30 }, // 0.60
          },
        }),
      ];

      // targetScore = 400 -> 400/990 = 0.404 -> clamped to 0.45, threshold 0.42, but floor < 0.60 catches part4
      const { weakParts } = computePartAccuracies(tests, 400);
      expect(weakParts).toEqual(["part4"]);
    });

    it("caps targetAccuracy at 0.92 for maximum targetScore (990)", () => {
      const tests: TestAttempt[] = [
        makeTestAttempt({
          parts: {
            part5: { correct: 27, total: 30 }, // 0.90 >= 0.89 -> OK
            part7: { correct: 48, total: 54 }, // 0.8889 < 0.89 -> Weak
          },
        }),
      ];

      const { weakParts } = computePartAccuracies(tests, 990);
      expect(weakParts).toEqual(["part7"]);
    });
  });

  describe("evaluateExamReadiness", () => {
    it("returns zeroed baseline when no full tests exist while preserving mini-test part accuracies", () => {
      const miniTest = makeTestAttempt({
        id: "mini-only",
        mode: "mini_or_part",
        totalScore: 0,
        parts: {
          part5: { correct: 15, total: 30 },
        },
      });

      const report = evaluateExamReadiness(
        [miniTest],
        750,
        "2026-12-24",
        NOW
      );

      expect(report).toMatchObject({
        isReliable: false,
        totalFullTestsCount: 0,
        sampleSize: 0,
        readinessIndex: 0,
        verdict: "needs_foundation",
        weightedAverage: 0,
        stdDeviation: 0,
        scoreReadiness: 0,
        stabilityScore: 0,
        pacingScore: 0,
        weakParts: ["part5"],
        trendDelta: 0,
      });
      expect(report.partAccuracies.part5.accuracy).toBe(0.5);
    });

    it("uses single-test neutral sigmaScore (60) and trendComponent (70) and marks unreliable when < 3 tests", () => {
      const test1 = makeTestAttempt({
        id: "f1",
        totalScore: 750,
        durationMinutes: 120,
      });

      // target = 750 -> weightedAvg = 750 -> scoreReadiness = 85
      // N = 1 -> sigmaScore = 60, passRate = 1 -> stability = 0.7*60 + 0.3*100 = 72
      // pacing: onTime = 100, trend = 70, gap = 0 -> timeline = 100 -> pacing = 50 + 14 + 30 = 94
      // index = round(0.55*85 + 0.25*72 + 0.20*94) = round(46.75 + 18 + 18.8) = round(83.55) = 84
      const report = evaluateExamReadiness([test1], 750, "2026-12-24", NOW);

      expect(report.isReliable).toBe(false);
      expect(report.totalFullTestsCount).toBe(1);
      expect(report.sampleSize).toBe(1);
      expect(report.weightedAverage).toBe(750);
      expect(report.stdDeviation).toBe(0);
      expect(report.scoreReadiness).toBe(85);
      expect(report.stabilityScore).toBe(72);
      expect(report.pacingScore).toBe(94);
      expect(report.trendDelta).toBe(0);
      expect(report.readinessIndex).toBe(84);
      expect(report.verdict).toBe("almost_ready");
    });

    it("sorts chronologically with tie-breakers and restricts rolling window to the latest 5 full tests", () => {
      const tests: TestAttempt[] = [
        // Out of chronological order, includes older tests that should be excluded from window
        makeTestAttempt({
          id: "t6-newest",
          takenAt: "2026-11-20",
          createdAt: "2026-11-20T12:00:00.000Z",
          totalScore: 800,
          durationMinutes: 115,
        }),
        makeTestAttempt({
          id: "t1-oldest-excluded",
          takenAt: "2026-11-01",
          totalScore: 400,
          durationMinutes: 140,
        }),
        makeTestAttempt({
          id: "t4-b",
          takenAt: "2026-11-15",
          createdAt: "2026-11-15T10:00:00.000Z",
          totalScore: 790,
          durationMinutes: 120,
        }),
        makeTestAttempt({
          id: "t4-a",
          takenAt: "2026-11-15",
          createdAt: "2026-11-15T10:00:00.000Z",
          totalScore: 780,
          durationMinutes: 120,
        }),
        makeTestAttempt({
          id: "t2-excluded",
          takenAt: "2026-11-05",
          totalScore: 450,
          durationMinutes: 135,
        }),
        makeTestAttempt({
          id: "t3",
          takenAt: "2026-11-10",
          totalScore: 760,
          durationMinutes: 120,
        }),
        makeTestAttempt({
          id: "t5",
          takenAt: "2026-11-18",
          totalScore: 795,
          durationMinutes: 118,
        }),
        makeTestAttempt({
          id: "mini-ignored-for-index",
          mode: "mini_or_part",
          takenAt: "2026-11-22",
          totalScore: 0,
          parts: { part7: { correct: 20, total: 54 } },
        }),
      ];

      const report = evaluateExamReadiness(tests, 750, "2026-12-20", NOW);

      // Window sorted: t3(760, w=1), t4-a(780, w=2), t4-b(790, w=3), t5(795, w=4), t6(800, w=5)
      // weightedAvg = (760 + 1560 + 2370 + 3180 + 4000) / 15 = 11870 / 15 = 791.333...
      expect(report.isReliable).toBe(true);
      expect(report.totalFullTestsCount).toBe(7);
      expect(report.sampleSize).toBe(5);
      expect(report.weightedAverage).toBe(791.3);
      expect(report.scoreReadiness).toBe(100);
      expect(report.weakParts).toEqual(["part7"]);
      // recentHalf = [790, 795, 800] (mean 795), earlierHalf = [760, 780] (mean 770) -> delta = +25
      expect(report.trendDelta).toBe(25);
      expect(report.verdict).toBe("exam_ready");
    });

    it("supports custom allTestsForParts separately from full-test input", () => {
      const fullTest = makeTestAttempt({
        id: "f1",
        totalScore: 780,
        parts: { part1: { correct: 6, total: 6 } },
      });
      const miniTest = makeTestAttempt({
        id: "m1",
        mode: "mini_or_part",
        totalScore: 0,
        parts: { part5: { correct: 12, total: 30 } },
      });

      const report = evaluateExamReadiness(
        [fullTest],
        750,
        null,
        NOW,
        [fullTest, miniTest]
      );

      expect(report.totalFullTestsCount).toBe(1);
      expect(report.weakParts).toEqual(["part5"]);
      expect(report.partAccuracies.part1.accuracy).toBe(1);
      expect(report.partAccuracies.part5.accuracy).toBe(0.4);
    });

    it("handles all ScoreReadiness, StabilityScore, and PacingScore timeline branches accurately", () => {
      // Branch A: muW in [target, safeTarget), stdDev >= 80, over-time pacing, null exam date
      // Scores: [600, 900] -> mean 750, stdDev = 150 (>= 80 -> sigmaScore = 20), passRate = 0.5 -> stability = 0.7*20 + 0.3*50 = 29
      // weightedAvg = (600 + 2*900)/3 = 800 -> target=790, safe=815 -> scoreReadiness = 85 + 15*(10/25) = 91
      // trendDelta = 300 -> trendComponent = 100; onTime = 0/2 (130m, 125m) = 0; gap = 0 -> timeline = 100
      // pacing = 0.5*0 + 0.2*100 + 0.3*100 = 50
      const highVarianceTests: TestAttempt[] = [
        makeTestAttempt({
          id: "hv-1",
          takenAt: "2026-11-01",
          totalScore: 600,
          durationMinutes: 130,
        }),
        makeTestAttempt({
          id: "hv-2",
          takenAt: "2026-11-10",
          totalScore: 900,
          durationMinutes: 125,
        }),
      ];
      const hvReport = evaluateExamReadiness(highVarianceTests, 790, null, NOW);
      expect(hvReport.weightedAverage).toBe(800);
      expect(hvReport.stdDeviation).toBe(150);
      expect(hvReport.scoreReadiness).toBe(91);
      expect(hvReport.stabilityScore).toBe(29);
      expect(hvReport.pacingScore).toBe(50);
      expect(hvReport.trendDelta).toBe(300);

      // Branch B: muW < target - 200 (scoreReadiness floored at 0), past exam date (daysLeft <= 0)
      const strugglingTests: TestAttempt[] = [
        makeTestAttempt({
          id: "s-1",
          takenAt: "2026-11-01",
          totalScore: 500,
          durationMinutes: 120,
        }),
        makeTestAttempt({
          id: "s-2",
          takenAt: "2026-11-05",
          totalScore: 450,
          durationMinutes: 120,
        }),
        makeTestAttempt({
          id: "s-3",
          takenAt: "2026-11-10",
          totalScore: 400,
          durationMinutes: 120,
        }),
      ];
      // weightedAvg = (500 + 900 + 1200)/6 = 2600/6 = 433.333...
      // target = 800 -> target - 200 = 600 -> scoreReadiness = 0
      // daysLeft = -1 (2026-11-23 vs 2026-11-24) -> timeline = max(10, 100 - gap*1.5) = 10
      // trendDelta = (450+400)/2 - 500 = -75 -> trendComponent = 30
      // onTime = 100 -> pacing = 0.5*100 + 0.2*30 + 0.3*10 = 59
      const pastDateReport = evaluateExamReadiness(
        strugglingTests,
        800,
        "2026-11-23",
        NOW
      );
      expect(pastDateReport.isReliable).toBe(true);
      expect(pastDateReport.scoreReadiness).toBe(0);
      expect(pastDateReport.pacingScore).toBe(59);
      expect(pastDateReport.trendDelta).toBe(-75);
      expect(pastDateReport.verdict).toBe("needs_foundation");

      // Branch C: timeline ratio in [1.0, 1.2) vs ratio < 1.0 vs null date with gap > 0
      const gapTests: TestAttempt[] = [
        makeTestAttempt({
          id: "g-1",
          takenAt: "2026-11-01",
          totalScore: 700,
          durationMinutes: 120,
        }),
        makeTestAttempt({
          id: "g-2",
          takenAt: "2026-11-05",
          totalScore: 700,
          durationMinutes: 120,
        }),
        makeTestAttempt({
          id: "g-3",
          takenAt: "2026-11-10",
          totalScore: 700,
          durationMinutes: 120,
        }),
      ];
      // gap = 750 - 700 = 50
      // daysLeft = 37 (2026-12-31 - 2026-11-24 = 37) -> ratio = (37 * 1.5)/50 = 1.11 -> timeline = 85 + 15*(0.11/0.2) = 93.25
      // onTime = 100, trendDelta = 0 (trendComponent = 65) -> pacing = 50 + 13 + 0.3*93.25 = 90.975 -> 91
      const midTimeline = evaluateExamReadiness(
        gapTests,
        750,
        "2026-12-31",
        NOW
      );
      expect(midTimeline.pacingScore).toBe(91);

      // null date with gap > 0 -> timeline = 75 -> pacing = 50 + 13 + 22.5 = 85.5
      const nullDateReport = evaluateExamReadiness(gapTests, 750, null, NOW);
      expect(nullDateReport.pacingScore).toBe(85.5);

      // very tight timeline: 2 days left -> ratio = 3/50 = 0.06 -> max(15, 85*0.06) = 15 -> pacing = 50 + 13 + 4.5 = 67.5
      const tightDateReport = evaluateExamReadiness(
        gapTests,
        750,
        "2026-11-26",
        NOW
      );
      expect(tightDateReport.pacingScore).toBe(67.5);
    });

    it("handles targetScore = 990 (safeTarget === clampedTarget) cleanly", () => {
      const perfectTests = [
        makeTestAttempt({ id: "p1", takenAt: "2026-11-01", totalScore: 990 }),
        makeTestAttempt({ id: "p2", takenAt: "2026-11-05", totalScore: 990 }),
        makeTestAttempt({ id: "p3", takenAt: "2026-11-10", totalScore: 990 }),
      ];

      const report = evaluateExamReadiness(
        perfectTests,
        990,
        "2026-12-01",
        NOW
      );
      expect(report.scoreReadiness).toBe(100);
      expect(report.stabilityScore).toBe(100);
      expect(report.readinessIndex).toBeGreaterThanOrEqual(88);
      expect(report.verdict).toBe("exam_ready");
    });
  });
});
