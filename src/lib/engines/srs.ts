import type { SrsGrade, VocabCard, VocabStatus } from "@/types/domain";

export const INITIAL_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
export const MASTERED_MIN_INTERVAL_DAYS = 21;
export const MASTERED_MIN_REPETITIONS = 4;
export const LEECH_LAPSE_THRESHOLD = 4;

const MS_PER_DAY = 86_400_000;

export type SrsCardSnapshot = Pick<
  VocabCard,
  "status" | "easeFactor" | "intervalDays" | "repetitions" | "lapses"
>;

export interface SrsTransitionResult {
  status: VocabStatus;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  isLeech: boolean;
  nextReviewAt: string;
  lastReviewedAt: string;
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function resolvePassedStatus(
  repetitions: number,
  intervalDays: number,
  allowLearning: boolean
): VocabStatus {
  if (
    repetitions >= MASTERED_MIN_REPETITIONS &&
    intervalDays >= MASTERED_MIN_INTERVAL_DAYS
  ) {
    return "mastered";
  }
  if (!allowLearning || repetitions >= 2) {
    return "review";
  }
  return "learning";
}

function compareTimestampAndId(
  isoA: string,
  idA: string,
  isoB: string,
  idB: string
): number {
  const timeA = new Date(isoA).getTime();
  const timeB = new Date(isoB).getTime();
  const normalizedA = Number.isFinite(timeA)
    ? timeA
    : Number.POSITIVE_INFINITY;
  const normalizedB = Number.isFinite(timeB)
    ? timeB
    : Number.POSITIVE_INFINITY;

  if (normalizedA !== normalizedB) {
    return normalizedA - normalizedB;
  }
  return idA.localeCompare(idB);
}

/**
 * Returns `true` when a vocabulary card has reached or exceeded the leech lapse threshold.
 */
export function isLeechCard(card: Pick<VocabCard, "lapses">): boolean {
  return card.lapses >= LEECH_LAPSE_THRESHOLD;
}

/**
 * Computes the next SM-2 SRS state transition for a card given a review grade (0..3).
 */
export function calculateNextSrsState(
  card: SrsCardSnapshot,
  grade: SrsGrade,
  now: Date = new Date()
): SrsTransitionResult {
  const currentEase = Math.max(
    MIN_EASE_FACTOR,
    card.easeFactor || INITIAL_EASE_FACTOR
  );
  const intervalDays = Math.max(0, card.intervalDays || 0);
  const repetitions = Math.max(0, card.repetitions || 0);
  const lapses = Math.max(0, card.lapses || 0);

  let nextRepetitions: number;
  let nextLapses: number;
  let nextInterval: number;
  let nextEase: number;
  let nextStatus: VocabStatus;

  switch (grade) {
    case 0: {
      nextRepetitions = 0;
      nextLapses = lapses + 1;
      nextInterval = 1;
      nextEase = round2(Math.max(MIN_EASE_FACTOR, currentEase - 0.2));
      nextStatus = "learning";
      break;
    }
    case 1: {
      nextRepetitions = repetitions;
      nextLapses = lapses;
      nextInterval = Math.max(1, Math.round(intervalDays * 1.2));
      nextEase = round2(Math.max(MIN_EASE_FACTOR, currentEase - 0.15));
      nextStatus = resolvePassedStatus(nextRepetitions, nextInterval, true);
      break;
    }
    case 2: {
      nextRepetitions = repetitions + 1;
      nextLapses = lapses;
      nextInterval =
        nextRepetitions === 1
          ? 1
          : nextRepetitions === 2
            ? 3
            : Math.max(1, Math.round(Math.max(1, intervalDays) * currentEase));
      nextEase = round2(currentEase);
      nextStatus = resolvePassedStatus(nextRepetitions, nextInterval, true);
      break;
    }
    case 3: {
      nextRepetitions = repetitions + 1;
      nextLapses = lapses;
      nextInterval = Math.round(
        Math.max(4, intervalDays * currentEase * 1.3)
      );
      nextEase = round2(currentEase + 0.15);
      nextStatus = resolvePassedStatus(nextRepetitions, nextInterval, false);
      break;
    }
  }

  const lastReviewedAt = now.toISOString();
  const nextReviewAt = new Date(
    now.getTime() + nextInterval * MS_PER_DAY
  ).toISOString();

  return {
    status: nextStatus,
    easeFactor: nextEase,
    intervalDays: nextInterval,
    repetitions: nextRepetitions,
    lapses: nextLapses,
    isLeech: nextLapses >= LEECH_LAPSE_THRESHOLD,
    nextReviewAt,
    lastReviewedAt,
  };
}

/**
 * Predicts the next interval (in days) for each SM-2 grade button (0: Again .. 3: Easy).
 */
export function previewGradeIntervals(
  card: SrsCardSnapshot,
  now: Date = new Date()
): Record<SrsGrade, number> {
  return {
    0: calculateNextSrsState(card, 0, now).intervalDays,
    1: calculateNextSrsState(card, 1, now).intervalDays,
    2: calculateNextSrsState(card, 2, now).intervalDays,
    3: calculateNextSrsState(card, 3, now).intervalDays,
  };
}

/**
 * Builds the deterministic daily study queue: overdue review/learning/mastered cards first,
 * followed by newly introduced cards capped at `dailyNewWordsLimit`.
 */
export function buildDailyStudyQueue(
  cards: VocabCard[],
  dailyNewWordsLimit: number,
  now: Date = new Date()
): { dueCards: VocabCard[]; newCards: VocabCard[]; queue: VocabCard[] } {
  const nowMs = now.getTime();
  const limit = Number.isNaN(dailyNewWordsLimit)
    ? 0
    : Math.max(0, Math.floor(dailyNewWordsLimit));

  const dueCards = cards
    .filter(
      (card) =>
        card.status !== "new" &&
        new Date(card.nextReviewAt).getTime() <= nowMs
    )
    .sort((a, b) =>
      compareTimestampAndId(a.nextReviewAt, a.id, b.nextReviewAt, b.id)
    );

  const newCards = cards
    .filter((card) => card.status === "new")
    .sort((a, b) =>
      compareTimestampAndId(a.createdAt, a.id, b.createdAt, b.id)
    )
    .slice(0, limit);

  return {
    dueCards,
    newCards,
    queue: [...dueCards, ...newCards],
  };
}
