import { daysUntilDate } from "@/lib/utils";
import type {
  ReadinessVerdict,
  TestAttempt,
  ToeicPartKey,
} from "@/types/domain";

const ALL_TOEIC_PARTS: readonly ToeicPartKey[] = [
  "part1",
  "part2",
  "part3",
  "part4",
  "part5",
  "part6",
  "part7",
];

const FULL_TEST_WINDOW_SIZE = 5;
const RELIABLE_MIN_FULL_TESTS = 3;
const FULL_TEST_TIME_LIMIT_MINUTES = 120;

export interface PartAccuracySummary {
  part: ToeicPartKey;
  correct: number;
  total: number;
  accuracy: number | null;
}

export interface ReadinessReport {
  isReliable: boolean;
  totalFullTestsCount: number;
  sampleSize: number;
  readinessIndex: number;
  verdict: ReadinessVerdict;
  weightedAverage: number;
  stdDeviation: number;
  scoreReadiness: number;
  stabilityScore: number;
  pacingScore: number;
  weakParts: ToeicPartKey[];
  partAccuracies: Record<ToeicPartKey, PartAccuracySummary>;
  trendDelta: number;
}

function round1(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampTargetScore(targetScore: number): number {
  if (!Number.isFinite(targetScore)) {
    return 750;
  }
  return clamp(10, 990, targetScore);
}

function compareIsoStrings(a: string, b: string): number {
  const timeA = Date.parse(a);
  const timeB = Date.parse(b);
  if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareFullTestsAscending(a: TestAttempt, b: TestAttempt): number {
  const takenCmp = compareIsoStrings(a.takenAt, b.takenAt);
  if (takenCmp !== 0) return takenCmp;

  const createdCmp = compareIsoStrings(a.createdAt, b.createdAt);
  if (createdCmp !== 0) return createdCmp;

  return a.id.localeCompare(b.id);
}

function meanOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function computeScoreReadiness(
  weightedAverage: number,
  clampedTarget: number,
  safeTarget: number
): number {
  if (weightedAverage >= safeTarget) {
    return 100;
  }
  if (weightedAverage >= clampedTarget) {
    if (safeTarget === clampedTarget) {
      return 100;
    }
    return (
      85 +
      15 * ((weightedAverage - clampedTarget) / (safeTarget - clampedTarget))
    );
  }
  return Math.max(0, 85 * ((weightedAverage - (clampedTarget - 200)) / 200));
}

function computeStabilityScore(
  scores: readonly number[],
  clampedTarget: number
): { stdDeviation: number; stabilityScore: number } {
  const n = scores.length;
  const avg = meanOf(scores);
  const variance =
    scores.reduce((sum, score) => sum + (score - avg) ** 2, 0) / n;
  const stdDeviation = Math.sqrt(variance);

  let sigmaScore: number;
  if (n === 1) {
    sigmaScore = 60;
  } else if (stdDeviation <= 20) {
    sigmaScore = 100;
  } else if (stdDeviation >= 80) {
    sigmaScore = 20;
  } else {
    sigmaScore = 100 - 80 * ((stdDeviation - 20) / 60);
  }

  const passCount = scores.filter((score) => score >= clampedTarget).length;
  const passRate = passCount / n;
  const stabilityScore = 0.7 * sigmaScore + 0.3 * (passRate * 100);

  return { stdDeviation, stabilityScore };
}

function computePacingScore(
  windowTests: readonly TestAttempt[],
  weightedAverage: number,
  clampedTarget: number,
  targetExamDate: string | null,
  now: Date
): { trendDelta: number; pacingScore: number } {
  const n = windowTests.length;
  const onTimeCount = windowTests.filter(
    (test) => test.durationMinutes <= FULL_TEST_TIME_LIMIT_MINUTES
  ).length;
  const onTimeComponent = (onTimeCount / n) * 100;

  let trendDelta = 0;
  let trendComponent = 70;
  if (n >= 2) {
    const mid = Math.floor(n / 2);
    const earlierMean = meanOf(
      windowTests.slice(0, mid).map((test) => test.totalScore)
    );
    const recentMean = meanOf(
      windowTests.slice(mid).map((test) => test.totalScore)
    );
    trendDelta = recentMean - earlierMean;
    trendComponent = clamp(30, 100, 65 + (trendDelta / 50) * 35);
  }

  const gap = Math.max(0, clampedTarget - weightedAverage);
  let timelineComponent: number;
  if (gap === 0) {
    timelineComponent = 100;
  } else {
    const daysLeft = daysUntilDate(targetExamDate, now);
    if (daysLeft === null) {
      timelineComponent = 75;
    } else if (daysLeft <= 0) {
      timelineComponent = Math.max(10, 100 - gap * 1.5);
    } else {
      const ratio = (daysLeft * 1.5) / gap;
      if (ratio >= 1.2) {
        timelineComponent = 100;
      } else if (ratio >= 1.0) {
        timelineComponent = 85 + 15 * ((ratio - 1.0) / 0.2);
      } else {
        timelineComponent = Math.max(15, 85 * ratio);
      }
    }
  }

  const pacingScore =
    0.5 * onTimeComponent + 0.2 * trendComponent + 0.3 * timelineComponent;

  return { trendDelta, pacingScore };
}

/**
 * Maps a numeric Readiness Index (0..100) to the 4-tier verdict enum.
 */
export function mapReadinessVerdict(readinessIndex: number): ReadinessVerdict {
  if (readinessIndex >= 88) return "exam_ready";
  if (readinessIndex >= 75) return "almost_ready";
  if (readinessIndex >= 50) return "approaching";
  return "needs_foundation";
}

/**
 * Aggregates question accuracies across Parts 1..7 for all provided test attempts
 * and identifies weak parts relative to the target score accuracy threshold.
 */
export function computePartAccuracies(
  tests: TestAttempt[],
  targetScore: number
): {
  partAccuracies: Record<ToeicPartKey, PartAccuracySummary>;
  weakParts: ToeicPartKey[];
} {
  const totals: Record<ToeicPartKey, { correct: number; total: number }> = {
    part1: { correct: 0, total: 0 },
    part2: { correct: 0, total: 0 },
    part3: { correct: 0, total: 0 },
    part4: { correct: 0, total: 0 },
    part5: { correct: 0, total: 0 },
    part6: { correct: 0, total: 0 },
    part7: { correct: 0, total: 0 },
  };

  for (const test of tests) {
    if (!test.parts) continue;

    for (const part of ALL_TOEIC_PARTS) {
      const partScore = test.parts[part];
      if (!partScore) continue;

      const safeTotal = Number.isFinite(partScore.total)
        ? Math.max(0, Math.round(partScore.total))
        : 0;
      const safeCorrect = Number.isFinite(partScore.correct)
        ? Math.min(safeTotal, Math.max(0, Math.round(partScore.correct)))
        : 0;

      totals[part].correct += safeCorrect;
      totals[part].total += safeTotal;
    }
  }

  const partAccuracies = {} as Record<ToeicPartKey, PartAccuracySummary>;
  for (const part of ALL_TOEIC_PARTS) {
    const { correct, total } = totals[part];
    partAccuracies[part] = {
      part,
      correct,
      total,
      accuracy: total > 0 ? Math.round((correct / total) * 10_000) / 10_000 : null,
    };
  }

  const clampedTarget = clampTargetScore(targetScore);
  const targetAccuracy = clamp(0.45, 0.92, clampedTarget / 990);

  const weakParts = ALL_TOEIC_PARTS.filter((part) => {
    const { accuracy } = partAccuracies[part];
    if (accuracy === null) return false;
    return accuracy < targetAccuracy - 0.03 || accuracy < 0.6;
  }).sort((a, b) => {
    const accA = partAccuracies[a].accuracy ?? 0;
    const accB = partAccuracies[b].accuracy ?? 0;
    if (accA !== accB) {
      return accA - accB;
    }
    return ALL_TOEIC_PARTS.indexOf(a) - ALL_TOEIC_PARTS.indexOf(b);
  });

  return { partAccuracies, weakParts };
}

/**
 * Evaluates overall TOEIC Exam Readiness using a rolling window of up to 5 recent Full Tests
 * across ScoreReadiness (55%), StabilityScore (25%), and PacingScore (20%).
 */
export function evaluateExamReadiness(
  tests: TestAttempt[],
  targetScore: number,
  targetExamDate: string | null,
  now: Date = new Date(),
  allTestsForParts?: TestAttempt[]
): ReadinessReport {
  const fullTests = tests
    .filter((test) => test.mode === "full_test")
    .sort(compareFullTestsAscending);

  const totalFullTestsCount = fullTests.length;
  const { partAccuracies, weakParts } = computePartAccuracies(
    allTestsForParts ?? tests,
    targetScore
  );

  if (totalFullTestsCount === 0) {
    return {
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
      weakParts,
      partAccuracies,
      trendDelta: 0,
    };
  }

  const windowTests = fullTests.slice(-FULL_TEST_WINDOW_SIZE);
  const sampleSize = windowTests.length;
  const isReliable = totalFullTestsCount >= RELIABLE_MIN_FULL_TESTS;

  const clampedTarget = clampTargetScore(targetScore);
  const safeTarget = Math.min(990, clampedTarget + 25);

  let weightedScoreSum = 0;
  let weightSum = 0;
  for (let idx = 0; idx < sampleSize; idx++) {
    const weight = idx + 1;
    weightedScoreSum += weight * windowTests[idx].totalScore;
    weightSum += weight;
  }
  const weightedAverage = weightedScoreSum / weightSum;

  const scoreReadiness = computeScoreReadiness(
    weightedAverage,
    clampedTarget,
    safeTarget
  );

  const scores = windowTests.map((test) => test.totalScore);
  const { stdDeviation, stabilityScore } = computeStabilityScore(
    scores,
    clampedTarget
  );

  const { trendDelta, pacingScore } = computePacingScore(
    windowTests,
    weightedAverage,
    clampedTarget,
    targetExamDate,
    now
  );

  const readinessIndex = clamp(
    0,
    100,
    Math.round(
      0.55 * scoreReadiness + 0.25 * stabilityScore + 0.2 * pacingScore
    )
  );

  return {
    isReliable,
    totalFullTestsCount,
    sampleSize,
    readinessIndex,
    verdict: mapReadinessVerdict(readinessIndex),
    weightedAverage: round1(weightedAverage),
    stdDeviation: round1(stdDeviation),
    scoreReadiness: round1(scoreReadiness),
    stabilityScore: round1(stabilityScore),
    pacingScore: round1(pacingScore),
    weakParts,
    partAccuracies,
    trendDelta: round1(trendDelta),
  };
}
