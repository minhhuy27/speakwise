import { describe, expect, it } from "vitest";
import {
  INITIAL_EASE_FACTOR,
  LEECH_LAPSE_THRESHOLD,
  MASTERED_MIN_INTERVAL_DAYS,
  MASTERED_MIN_REPETITIONS,
  MIN_EASE_FACTOR,
  buildDailyStudyQueue,
  calculateNextSrsState,
  isLeechCard,
  previewGradeIntervals,
  type SrsCardSnapshot,
} from "@/lib/engines/srs";
import type { VocabCard } from "@/types/domain";

const FIXED_NOW = new Date("2026-11-24T09:00:00.000Z");

function makeVocabCard(overrides: Partial<VocabCard> = {}): VocabCard {
  return {
    id: "vocab-1",
    word: "negotiate",
    displayWord: "negotiate",
    ipa: "/nɪˈɡoʊ.ʃi.eɪt/",
    partOfSpeech: "verb",
    meaningEn: "To discuss something formally to reach an agreement",
    meaningVi: "Đàm phán",
    exampleEn: "We need to negotiate the contract terms before Friday.",
    exampleVi: "Chúng ta cần đàm phán các điều khoản hợp đồng trước thứ Sáu.",
    wordFamily: ["negotiation", "negotiator"],
    collocations: ["negotiate a contract"],
    tags: ["contracts"],
    status: "new",
    easeFactor: INITIAL_EASE_FACTOR,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    nextReviewAt: "2026-11-24T09:00:00.000Z",
    createdAt: "2026-11-20T09:00:00.000Z",
    updatedAt: "2026-11-20T09:00:00.000Z",
    ...overrides,
  };
}

describe("SRS Engine", () => {
  describe("constants and isLeechCard", () => {
    it("exports expected SM-2 threshold constants", () => {
      expect(INITIAL_EASE_FACTOR).toBe(2.5);
      expect(MIN_EASE_FACTOR).toBe(1.3);
      expect(MASTERED_MIN_INTERVAL_DAYS).toBe(21);
      expect(MASTERED_MIN_REPETITIONS).toBe(4);
      expect(LEECH_LAPSE_THRESHOLD).toBe(4);
    });

    it("detects leech cards when lapses reach or exceed threshold", () => {
      expect(isLeechCard({ lapses: 0 })).toBe(false);
      expect(isLeechCard({ lapses: 3 })).toBe(false);
      expect(isLeechCard({ lapses: 4 })).toBe(true);
      expect(isLeechCard({ lapses: 7 })).toBe(true);
    });
  });

  describe("calculateNextSrsState", () => {
    it("normalizes degenerate or negative card fields safely", () => {
      const zeroEaseCard: SrsCardSnapshot = {
        status: "new",
        easeFactor: 0,
        intervalDays: -4,
        repetitions: -2,
        lapses: -1,
      };
      const result = calculateNextSrsState(zeroEaseCard, 2, FIXED_NOW);
      expect(result.easeFactor).toBe(2.5);
      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.lapses).toBe(0);
      expect(result.status).toBe("learning");

      const lowEaseCard: SrsCardSnapshot = {
        status: "review",
        easeFactor: 0.9,
        intervalDays: 5,
        repetitions: 2,
        lapses: 1,
      };
      const hardResult = calculateNextSrsState(lowEaseCard, 1, FIXED_NOW);
      expect(hardResult.easeFactor).toBe(MIN_EASE_FACTOR);
    });

    it("handles Grade 0 (Again): resets repetitions, increments lapses, floors ease, marks leech at 4 lapses", () => {
      const reviewCard: SrsCardSnapshot = {
        status: "review",
        easeFactor: 2.5,
        intervalDays: 14,
        repetitions: 3,
        lapses: 2,
      };

      const firstAgain = calculateNextSrsState(reviewCard, 0, FIXED_NOW);
      expect(firstAgain).toEqual({
        status: "learning",
        easeFactor: 2.3,
        intervalDays: 1,
        repetitions: 0,
        lapses: 3,
        isLeech: false,
        lastReviewedAt: "2026-11-24T09:00:00.000Z",
        nextReviewAt: "2026-11-25T09:00:00.000Z",
      });

      const secondAgain = calculateNextSrsState(firstAgain, 0, FIXED_NOW);
      expect(secondAgain.lapses).toBe(4);
      expect(secondAgain.isLeech).toBe(true);
      expect(secondAgain.easeFactor).toBe(2.1);

      const floorCard: SrsCardSnapshot = {
        status: "learning",
        easeFactor: 1.35,
        intervalDays: 1,
        repetitions: 0,
        lapses: 5,
      };
      const floored = calculateNextSrsState(floorCard, 0, FIXED_NOW);
      expect(floored.easeFactor).toBe(1.3);
      expect(floored.isLeech).toBe(true);
    });

    it("handles Grade 1 (Hard): keeps repetitions, multiplies interval by 1.2 (min 1), reduces ease by 0.15", () => {
      const newCard: SrsCardSnapshot = {
        status: "new",
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        lapses: 0,
      };
      const hardNew = calculateNextSrsState(newCard, 1, FIXED_NOW);
      expect(hardNew.repetitions).toBe(0);
      expect(hardNew.lapses).toBe(0);
      expect(hardNew.intervalDays).toBe(1);
      expect(hardNew.easeFactor).toBe(2.35);
      expect(hardNew.status).toBe("learning");

      const reviewCard: SrsCardSnapshot = {
        status: "review",
        easeFactor: 2.0,
        intervalDays: 10,
        repetitions: 2,
        lapses: 0,
      };
      const hardReview = calculateNextSrsState(reviewCard, 1, FIXED_NOW);
      expect(hardReview.intervalDays).toBe(12);
      expect(hardReview.easeFactor).toBe(1.85);
      expect(hardReview.status).toBe("review");

      const nearMasteredCard: SrsCardSnapshot = {
        status: "review",
        easeFactor: 2.2,
        intervalDays: 18,
        repetitions: 4,
        lapses: 0,
      };
      const hardMastered = calculateNextSrsState(
        nearMasteredCard,
        1,
        FIXED_NOW
      );
      expect(hardMastered.intervalDays).toBe(22);
      expect(hardMastered.status).toBe("mastered");
    });

    it("handles Grade 2 (Good): follows 1d -> 3d -> round(interval*ease) and promotes to mastered at rep >= 4 and interval >= 21", () => {
      let state: SrsCardSnapshot = {
        status: "new",
        easeFactor: INITIAL_EASE_FACTOR,
        intervalDays: 0,
        repetitions: 0,
        lapses: 0,
      };

      // Rep 1: 1 day, learning
      const step1 = calculateNextSrsState(state, 2, FIXED_NOW);
      expect(step1.repetitions).toBe(1);
      expect(step1.intervalDays).toBe(1);
      expect(step1.easeFactor).toBe(2.5);
      expect(step1.status).toBe("learning");

      // Rep 2: 3 days, review
      const step2 = calculateNextSrsState(step1, 2, FIXED_NOW);
      expect(step2.repetitions).toBe(2);
      expect(step2.intervalDays).toBe(3);
      expect(step2.status).toBe("review");

      // Rep 3: round(3 * 2.5) = 8 days, review
      const step3 = calculateNextSrsState(step2, 2, FIXED_NOW);
      expect(step3.repetitions).toBe(3);
      expect(step3.intervalDays).toBe(8);
      expect(step3.status).toBe("review");

      // Rep 4: round(8 * 2.5) = 20 days -> still review because 20 < 21
      const step4 = calculateNextSrsState(step3, 2, FIXED_NOW);
      expect(step4.repetitions).toBe(4);
      expect(step4.intervalDays).toBe(20);
      expect(step4.status).toBe("review");

      // Rep 5: round(20 * 2.5) = 50 days -> mastered
      const step5 = calculateNextSrsState(step4, 2, FIXED_NOW);
      expect(step5.repetitions).toBe(5);
      expect(step5.intervalDays).toBe(50);
      expect(step5.status).toBe("mastered");
      expect(step5.nextReviewAt).toBe(
        new Date(FIXED_NOW.getTime() + 50 * 86_400_000).toISOString()
      );

      // Exact boundary: rep 3 -> 4 with interval 9 * 2.5 = 22.5 -> 23 >= 21 -> mastered
      state = {
        status: "review",
        easeFactor: 2.5,
        intervalDays: 9,
        repetitions: 3,
        lapses: 0,
      };
      const exactBoundary = calculateNextSrsState(state, 2, FIXED_NOW);
      expect(exactBoundary.repetitions).toBe(4);
      expect(exactBoundary.intervalDays).toBe(23);
      expect(exactBoundary.status).toBe("mastered");
    });

    it("handles Grade 3 (Easy): enforces min 4d interval, skips learning, increases ease by 0.15", () => {
      const newCard: SrsCardSnapshot = {
        status: "new",
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        lapses: 0,
      };
      const easyNew = calculateNextSrsState(newCard, 3, FIXED_NOW);
      expect(easyNew.repetitions).toBe(1);
      expect(easyNew.intervalDays).toBe(4);
      expect(easyNew.easeFactor).toBe(2.65);
      expect(easyNew.status).toBe("review");

      // High interval but repetitions < 4 remains review
      const lowRepsLargeInterval: SrsCardSnapshot = {
        status: "review",
        easeFactor: 2.5,
        intervalDays: 10,
        repetitions: 1,
        lapses: 0,
      };
      const stillReview = calculateNextSrsState(
        lowRepsLargeInterval,
        3,
        FIXED_NOW
      );
      expect(stillReview.repetitions).toBe(2);
      expect(stillReview.intervalDays).toBe(33);
      expect(stillReview.status).toBe("review");

      // Rep 3 -> 4 with interval 7 * 2.5 * 1.3 = 22.75 -> 23 -> mastered
      const promoteCard: SrsCardSnapshot = {
        status: "review",
        easeFactor: 2.5,
        intervalDays: 7,
        repetitions: 3,
        lapses: 0,
      };
      const promoted = calculateNextSrsState(promoteCard, 3, FIXED_NOW);
      expect(promoted.repetitions).toBe(4);
      expect(promoted.intervalDays).toBe(23);
      expect(promoted.easeFactor).toBe(2.65);
      expect(promoted.status).toBe("mastered");
    });

    it("avoids floating point drift on easeFactor rounding", () => {
      const card: SrsCardSnapshot = {
        status: "review",
        easeFactor: 2.35,
        intervalDays: 4,
        repetitions: 2,
        lapses: 0,
      };
      const res1 = calculateNextSrsState(card, 1, FIXED_NOW);
      expect(res1.easeFactor).toBe(2.2);

      const res2 = calculateNextSrsState(res1, 3, FIXED_NOW);
      expect(res2.easeFactor).toBe(2.35);
    });
  });

  describe("previewGradeIntervals", () => {
    it("returns predicted intervalDays matching calculateNextSrsState for grades 0..3", () => {
      const card: SrsCardSnapshot = {
        status: "review",
        easeFactor: 2.5,
        intervalDays: 6,
        repetitions: 2,
        lapses: 0,
      };

      expect(previewGradeIntervals(card, FIXED_NOW)).toEqual({
        0: 1,
        1: 7,
        2: 15,
        3: 20,
      });
    });
  });

  describe("buildDailyStudyQueue", () => {
    it("orders due cards before new cards, sorts deterministically, and enforces dailyNewWordsLimit", () => {
      const cards: VocabCard[] = [
        makeVocabCard({
          id: "future-review",
          status: "review",
          nextReviewAt: "2026-11-25T09:00:00.000Z",
        }),
        makeVocabCard({
          id: "due-b",
          status: "review",
          nextReviewAt: "2026-11-24T08:00:00.000Z",
        }),
        makeVocabCard({
          id: "due-a",
          status: "learning",
          nextReviewAt: "2026-11-24T08:00:00.000Z",
        }),
        makeVocabCard({
          id: "due-mastered-earliest",
          status: "mastered",
          nextReviewAt: "2026-11-23T09:00:00.000Z",
        }),
        makeVocabCard({
          id: "due-exact-now",
          status: "review",
          nextReviewAt: "2026-11-24T09:00:00.000Z",
        }),
        makeVocabCard({
          id: "new-3",
          status: "new",
          createdAt: "2026-11-22T10:00:00.000Z",
          nextReviewAt: "2026-11-20T00:00:00.000Z",
        }),
        makeVocabCard({
          id: "new-2",
          status: "new",
          createdAt: "2026-11-21T10:00:00.000Z",
        }),
        makeVocabCard({
          id: "new-1",
          status: "new",
          createdAt: "2026-11-21T10:00:00.000Z",
        }),
      ];

      const snapshot = [...cards];
      const result = buildDailyStudyQueue(cards, 2, FIXED_NOW);

      expect(cards).toEqual(snapshot);
      expect(result.dueCards.map((c) => c.id)).toEqual([
        "due-mastered-earliest",
        "due-a",
        "due-b",
        "due-exact-now",
      ]);
      expect(result.newCards.map((c) => c.id)).toEqual(["new-1", "new-2"]);
      expect(result.queue.map((c) => c.id)).toEqual([
        "due-mastered-earliest",
        "due-a",
        "due-b",
        "due-exact-now",
        "new-1",
        "new-2",
      ]);
    });

    it("handles zero, negative, fractional, and NaN dailyNewWordsLimit cleanly", () => {
      const cards = [
        makeVocabCard({
          id: "new-1",
          status: "new",
          createdAt: "2026-11-20T00:00:00.000Z",
        }),
        makeVocabCard({
          id: "new-2",
          status: "new",
          createdAt: "2026-11-21T00:00:00.000Z",
        }),
      ];

      expect(buildDailyStudyQueue(cards, 0, FIXED_NOW).newCards).toHaveLength(
        0
      );
      expect(buildDailyStudyQueue(cards, -5, FIXED_NOW).newCards).toHaveLength(
        0
      );
      expect(
        buildDailyStudyQueue(cards, Number.NaN, FIXED_NOW).newCards
      ).toHaveLength(0);
      expect(buildDailyStudyQueue(cards, 1.9, FIXED_NOW).newCards).toHaveLength(
        1
      );
    });
  });
});
