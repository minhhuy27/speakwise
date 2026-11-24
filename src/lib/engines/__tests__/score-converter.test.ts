import { describe, expect, it } from "vitest";
import {
  LISTENING_CONVERSION_TABLE,
  LISTENING_PARTS,
  PART_MAX_QUESTIONS,
  READING_CONVERSION_TABLE,
  READING_PARTS,
  estimateToeicScore,
  summarizePartScores,
} from "@/lib/engines/score-converter";

describe("TOEIC Score Converter Engine", () => {
  describe("PART_MAX_QUESTIONS and section definitions", () => {
    it("sums to 100 Listening questions and 100 Reading questions", () => {
      const listeningTotal = LISTENING_PARTS.reduce(
        (sum, part) => sum + PART_MAX_QUESTIONS[part],
        0
      );
      const readingTotal = READING_PARTS.reduce(
        (sum, part) => sum + PART_MAX_QUESTIONS[part],
        0
      );

      expect(listeningTotal).toBe(100);
      expect(readingTotal).toBe(100);
      expect(PART_MAX_QUESTIONS).toEqual({
        part1: 6,
        part2: 25,
        part3: 39,
        part4: 30,
        part5: 30,
        part6: 16,
        part7: 54,
      });
    });
  });

  describe("ETS conversion table invariants", () => {
    it("defines 101 monotonically non-decreasing 5-point-stepped entries in [5, 495]", () => {
      for (const table of [
        LISTENING_CONVERSION_TABLE,
        READING_CONVERSION_TABLE,
      ]) {
        expect(table).toHaveLength(101);
        for (let i = 0; i < table.length; i++) {
          const val = table[i];
          expect(val).toBeGreaterThanOrEqual(5);
          expect(val).toBeLessThanOrEqual(495);
          expect(val % 5).toBe(0);
          if (i > 0) {
            expect(val).toBeGreaterThanOrEqual(table[i - 1]);
          }
        }
      }
    });

    it("matches ETS-calibrated anchor points for Listening and Reading", () => {
      expect(LISTENING_CONVERSION_TABLE[0]).toBe(5);
      expect(LISTENING_CONVERSION_TABLE[75]).toBe(395);
      for (let raw = 96; raw <= 100; raw++) {
        expect(LISTENING_CONVERSION_TABLE[raw]).toBe(495);
      }

      expect(READING_CONVERSION_TABLE[0]).toBe(5);
      expect(READING_CONVERSION_TABLE[70]).toBe(335);
      expect(READING_CONVERSION_TABLE[99]).toBe(495);
      expect(READING_CONVERSION_TABLE[100]).toBe(495);
    });
  });

  describe("estimateToeicScore", () => {
    it("computes exact boundary and mid-range scaled scores", () => {
      expect(estimateToeicScore(0, 0)).toEqual({
        listeningScore: 5,
        readingScore: 5,
        totalScore: 10,
      });

      expect(estimateToeicScore(75, 70)).toEqual({
        listeningScore: 395,
        readingScore: 335,
        totalScore: 730,
      });

      expect(estimateToeicScore(96, 99)).toEqual({
        listeningScore: 495,
        readingScore: 495,
        totalScore: 990,
      });

      expect(estimateToeicScore(100, 100)).toEqual({
        listeningScore: 495,
        readingScore: 495,
        totalScore: 990,
      });
    });

    it("clamps negative, over-100, fractional, and non-finite inputs cleanly", () => {
      expect(estimateToeicScore(-12, 145)).toEqual({
        listeningScore: 5,
        readingScore: 495,
        totalScore: 500,
      });

      expect(estimateToeicScore(74.6, 70.4)).toEqual({
        listeningScore: 395,
        readingScore: 335,
        totalScore: 730,
      });

      expect(estimateToeicScore(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
        listeningScore: 5,
        readingScore: 5,
        totalScore: 10,
      });

      expect(estimateToeicScore(Number.NEGATIVE_INFINITY, 100)).toEqual({
        listeningScore: 5,
        readingScore: 495,
        totalScore: 500,
      });
    });
  });

  describe("summarizePartScores", () => {
    it("aggregates full and partial part maps accurately", () => {
      expect(summarizePartScores({})).toEqual({
        listeningCorrect: 0,
        listeningTotal: 0,
        readingCorrect: 0,
        readingTotal: 0,
      });

      expect(
        summarizePartScores({
          part1: { correct: 5, total: 6 },
          part2: { correct: 20, total: 25 },
          part3: { correct: 30, total: 39 },
          part4: { correct: 24, total: 30 },
          part5: { correct: 25, total: 30 },
          part6: { correct: 12, total: 16 },
          part7: { correct: 40, total: 54 },
        })
      ).toEqual({
        listeningCorrect: 79,
        listeningTotal: 100,
        readingCorrect: 77,
        readingTotal: 100,
      });

      expect(
        summarizePartScores({
          part2: { correct: 18, total: 25 },
          part7: { correct: 35, total: 54 },
        })
      ).toEqual({
        listeningCorrect: 18,
        listeningTotal: 25,
        readingCorrect: 35,
        readingTotal: 54,
      });
    });

    it("sanitizes invalid negative or over-total part entries", () => {
      expect(
        summarizePartScores({
          part1: { correct: 10, total: 6 },
          part5: { correct: -3, total: 30 },
        })
      ).toEqual({
        listeningCorrect: 6,
        listeningTotal: 6,
        readingCorrect: 0,
        readingTotal: 30,
      });
    });
  });
});
