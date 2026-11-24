import { describe, expect, it } from "vitest";
import {
  buildBackupPayload,
  parseAndValidateBackupJson,
  serializeBackupPayload,
  stripUndefinedDeep,
} from "@/lib/backup";
import type {
  MistakeRecord,
  TestAttempt,
  UserProfile,
  VocabCard,
} from "@/types/domain";

const sampleProfile: UserProfile = {
  uid: "user-1",
  email: "learner@example.com",
  displayName: "TOEIC Learner",
  targetScore: 850,
  targetListening: 440,
  targetReading: 410,
  targetExamDate: "2026-12-15",
  dailyNewWordsLimit: 20,
  onboardingCompleted: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

const sampleVocab: VocabCard[] = [
  {
    id: "v1",
    word: "reimburse",
    displayWord: "reimburse",
    ipa: "/ˌriː.ɪmˈbɜːrs/",
    partOfSpeech: "verb",
    meaningEn: "To repay money spent on behalf of a company or person.",
    meaningVi: "Hoàn trả chi phí",
    exampleEn: "The company will reimburse travel expenses.",
    exampleVi: "Công ty sẽ hoàn trả chi phí đi lại.",
    audioUrl: undefined,
    wordFamily: ["reimbursement"],
    collocations: ["reimburse expenses"],
    tags: ["Part 7", "Finance"],
    personalNote: undefined,
    status: "review",
    easeFactor: 2.5,
    intervalDays: 6,
    repetitions: 2,
    lapses: 0,
    nextReviewAt: "2026-11-28T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-10T00:00:00.000Z",
  },
];

const sampleTests: TestAttempt[] = [
  {
    id: "t1",
    mode: "full_test",
    title: "ETS 2024 Test 1",
    source: "ETS 2024",
    takenAt: "2026-11-15",
    durationMinutes: 120,
    parts: {
      part1: { correct: 6, total: 6 },
      part5: { correct: 25, total: 30 },
    },
    listeningCorrect: 86,
    readingCorrect: 78,
    listeningScore: 430,
    readingScore: 375,
    totalScore: 805,
    isManualScoreOverride: false,
    reflectionNote: undefined,
    mistakeCount: 1,
    createdAt: "2026-11-15T09:00:00.000Z",
    updatedAt: "2026-11-15T11:00:00.000Z",
  },
];

const sampleMistakes: MistakeRecord[] = [
  {
    id: "m1",
    testId: "t1",
    testTitle: "ETS 2024 Test 1",
    part: 5,
    questionNumber: 112,
    errorCategory: "vocab",
    promptSnippet: "Employees must submit receipts to be ___ for travel.",
    userAnswer: "A",
    correctAnswer: "C",
    explanation: "Reimburse means to repay expenses.",
    extractedWord: "reimburse",
    linkedVocabId: "v1",
    createdAt: "2026-11-15T11:05:00.000Z",
  },
];

describe("backup utilities & validation", () => {
  it("stripUndefinedDeep removes undefined properties while preserving null, primitives, and arrays", () => {
    const input = {
      name: "SpeakWise",
      nullableField: null,
      omitted: undefined,
      nested: {
        keep: 42,
        drop: undefined,
      },
      items: [
        { a: 1, b: undefined },
        { c: null, d: "ok" },
      ],
    };

    const cleaned = stripUndefinedDeep(input);

    expect(cleaned).toEqual({
      name: "SpeakWise",
      nullableField: null,
      nested: { keep: 42 },
      items: [{ a: 1 }, { c: null, d: "ok" }],
    });
    expect("omitted" in cleaned).toBe(false);
    expect("drop" in cleaned.nested).toBe(false);
    expect("b" in cleaned.items[0]).toBe(false);
  });

  it("round-trips buildBackupPayload -> serializeBackupPayload -> parseAndValidateBackupJson", () => {
    const fixedNow = new Date("2026-11-24T07:00:00.000Z");
    const payload = buildBackupPayload({
      profile: sampleProfile,
      vocab: sampleVocab,
      tests: sampleTests,
      mistakes: sampleMistakes,
      now: fixedNow,
    });

    expect(payload.app).toBe("speakwise");
    expect(payload.version).toBe(1);
    expect(payload.exportedAt).toBe("2026-11-24T07:00:00.000Z");
    expect("audioUrl" in payload.vocab[0]).toBe(false);
    expect("reflectionNote" in payload.tests[0]).toBe(false);

    const serialized = serializeBackupPayload(payload);
    const parsed = parseAndValidateBackupJson(serialized);

    expect(parsed).toEqual(payload);
  });

  it("rejects malformed JSON strings", () => {
    expect(() => parseAndValidateBackupJson("{not valid json")).toThrow(
      /malformed json/i
    );
  });

  it("rejects backups with wrong app identifier or unsupported version", () => {
    const wrongApp = JSON.stringify({
      app: "other-app",
      version: 1,
      exportedAt: "2026-11-24T07:00:00.000Z",
      vocab: [],
      tests: [],
      mistakes: [],
    });

    const wrongVersion = JSON.stringify({
      app: "speakwise",
      version: 2,
      exportedAt: "2026-11-24T07:00:00.000Z",
      vocab: [],
      tests: [],
      mistakes: [],
    });

    expect(() => parseAndValidateBackupJson(wrongApp)).toThrow(
      /invalid speakwise backup file/i
    );
    expect(() => parseAndValidateBackupJson(wrongVersion)).toThrow(
      /invalid speakwise backup file/i
    );
  });
});
