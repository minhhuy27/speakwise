import type { PartScore, ToeicPartKey } from "@/types/domain";

export const PART_MAX_QUESTIONS: Record<ToeicPartKey, number> = {
  part1: 6,
  part2: 25,
  part3: 39,
  part4: 30,
  part5: 30,
  part6: 16,
  part7: 54,
};

export const LISTENING_PARTS: readonly ToeicPartKey[] = [
  "part1",
  "part2",
  "part3",
  "part4",
];

export const READING_PARTS: readonly ToeicPartKey[] = [
  "part5",
  "part6",
  "part7",
];

/**
 * ETS-calibrated Listening raw-to-scaled conversion table (indices 0..100 -> 5..495).
 */
export const LISTENING_CONVERSION_TABLE: readonly number[] = [
  // 0..10
  5, 5, 5, 5, 5, 5, 5, 10, 15, 20, 25,
  // 11..20
  30, 35, 40, 45, 50, 55, 60, 65, 70, 75,
  // 21..30
  80, 85, 95, 100, 105, 110, 115, 125, 130, 135,
  // 31..40
  140, 145, 150, 160, 165, 170, 175, 180, 185, 195,
  // 41..50
  200, 205, 210, 215, 225, 230, 235, 240, 245, 250,
  // 51..60
  260, 265, 270, 275, 280, 285, 295, 300, 305, 310,
  // 61..70
  315, 325, 330, 335, 340, 345, 350, 360, 365, 370,
  // 71..80
  375, 380, 385, 390, 395, 400, 400, 405, 410, 415,
  // 81..90
  420, 425, 430, 435, 440, 445, 450, 455, 460, 465,
  // 91..100
  470, 475, 480, 485, 490, 495, 495, 495, 495, 495,
];

/**
 * ETS-calibrated Reading raw-to-scaled conversion table (indices 0..100 -> 5..495).
 */
export const READING_CONVERSION_TABLE: readonly number[] = [
  // 0..10
  5, 5, 5, 5, 5, 5, 5, 5, 5, 10, 15,
  // 11..20
  20, 25, 30, 35, 40, 45, 50, 55, 60, 65,
  // 21..30
  70, 75, 80, 85, 90, 95, 100, 110, 115, 120,
  // 31..40
  125, 130, 135, 140, 145, 150, 155, 160, 165, 175,
  // 41..50
  180, 185, 190, 195, 200, 205, 210, 215, 220, 225,
  // 51..60
  230, 240, 245, 250, 255, 260, 265, 270, 275, 280,
  // 61..70
  285, 290, 295, 305, 310, 315, 320, 325, 330, 335,
  // 71..80
  340, 345, 350, 355, 360, 370, 375, 380, 385, 390,
  // 81..90
  395, 400, 405, 415, 420, 425, 430, 435, 440, 445,
  // 91..100
  450, 460, 465, 470, 475, 480, 485, 490, 495, 495,
];

function clampRawCorrect(rawCorrect: number): number {
  if (!Number.isFinite(rawCorrect)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(rawCorrect)));
}

function sumSectionParts(
  parts: Partial<Record<ToeicPartKey, PartScore>>,
  sectionParts: readonly ToeicPartKey[]
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;

  for (const part of sectionParts) {
    const entry = parts[part];
    if (!entry) continue;

    const safeTotal = Number.isFinite(entry.total)
      ? Math.max(0, Math.round(entry.total))
      : 0;
    const safeCorrect = Number.isFinite(entry.correct)
      ? Math.min(safeTotal, Math.max(0, Math.round(entry.correct)))
      : 0;

    correct += safeCorrect;
    total += safeTotal;
  }

  return { correct, total };
}

/**
 * Estimates scaled TOEIC Listening (5..495), Reading (5..495), and Total (10..990) scores
 * from raw correct counts (0..100).
 */
export function estimateToeicScore(
  listeningCorrect: number,
  readingCorrect: number
): { listeningScore: number; readingScore: number; totalScore: number } {
  const safeListening = clampRawCorrect(listeningCorrect);
  const safeReading = clampRawCorrect(readingCorrect);

  const listeningScore = LISTENING_CONVERSION_TABLE[safeListening] ?? 5;
  const readingScore = READING_CONVERSION_TABLE[safeReading] ?? 5;

  return {
    listeningScore,
    readingScore,
    totalScore: listeningScore + readingScore,
  };
}

/**
 * Aggregates raw correct and total question counts across Listening (Parts 1..4)
 * and Reading (Parts 5..7) from a partial part-score map.
 */
export function summarizePartScores(
  parts: Partial<Record<ToeicPartKey, PartScore>>
): {
  listeningCorrect: number;
  listeningTotal: number;
  readingCorrect: number;
  readingTotal: number;
} {
  const listening = sumSectionParts(parts, LISTENING_PARTS);
  const reading = sumSectionParts(parts, READING_PARTS);

  return {
    listeningCorrect: listening.correct,
    listeningTotal: listening.total,
    readingCorrect: reading.correct,
    readingTotal: reading.total,
  };
}
