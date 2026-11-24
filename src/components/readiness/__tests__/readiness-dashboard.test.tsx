import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiCoachCard } from "@/components/readiness/ai-coach-card";
import { ReadinessGauge } from "@/components/readiness/readiness-gauge";
import { getIdToken } from "@/lib/firebase/auth";
import type { ReadinessReport } from "@/lib/engines/readiness";
import type { MistakeRecord, TestAttempt, VocabCard } from "@/types/domain";

vi.mock("@/lib/firebase/auth", () => ({
  getIdToken: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function makeSampleReport(
  overrides: Partial<ReadinessReport> = {}
): ReadinessReport {
  return {
    isReliable: true,
    totalFullTestsCount: 3,
    sampleSize: 3,
    readinessIndex: 82,
    verdict: "almost_ready",
    weightedAverage: 760,
    stdDeviation: 18.5,
    scoreReadiness: 88,
    stabilityScore: 84,
    pacingScore: 63,
    weakParts: ["part7"],
    partAccuracies: {
      part1: { part: "part1", correct: 16, total: 18, accuracy: 0.8889 },
      part2: { part: "part2", correct: 62, total: 75, accuracy: 0.8267 },
      part3: { part: "part3", correct: 95, total: 117, accuracy: 0.812 },
      part4: { part: "part4", correct: 72, total: 90, accuracy: 0.8 },
      part5: { part: "part5", correct: 71, total: 90, accuracy: 0.7889 },
      part6: { part: "part6", correct: 37, total: 48, accuracy: 0.7708 },
      part7: { part: "part7", correct: 105, total: 162, accuracy: 0.6481 },
    },
    trendDelta: 25,
    ...overrides,
  };
}

function makeFullTest(overrides: Partial<TestAttempt> = {}): TestAttempt {
  return {
    id: "test-1",
    mode: "full_test",
    title: "ETS 2024 Test 1",
    source: "ETS 2024",
    takenAt: "2026-11-20",
    durationMinutes: 118,
    parts: {
      part5: { correct: 24, total: 30 },
      part7: { correct: 35, total: 54 },
    },
    listeningCorrect: 82,
    readingCorrect: 72,
    listeningScore: 410,
    readingScore: 350,
    totalScore: 760,
    isManualScoreOverride: false,
    mistakeCount: 1,
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z",
    ...overrides,
  };
}

function makeMistake(overrides: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    id: "mistake-1",
    testId: "test-1",
    testTitle: "ETS 2024 Test 1",
    part: 7,
    questionNumber: 184,
    errorCategory: "time_pressure",
    promptSnippet: "Double passage inference on delivery policy",
    createdAt: "2026-11-20T11:00:00.000Z",
    ...overrides,
  };
}

function makeVocabCard(overrides: Partial<VocabCard> = {}): VocabCard {
  return {
    id: "vocab-1",
    word: "allocate",
    displayWord: "allocate",
    ipa: "/ˈæl.ə.keɪt/",
    partOfSpeech: "verb",
    meaningEn: "To distribute resources or duties for a particular purpose",
    meaningVi: "Phân bổ",
    exampleEn: "Management will allocate extra funds to R&D.",
    exampleVi: "Ban quản lý sẽ phân bổ thêm kinh phí cho R&D.",
    wordFamily: ["allocation"],
    collocations: ["allocate resources"],
    tags: ["Finance"],
    status: "mastered",
    easeFactor: 2.5,
    intervalDays: 25,
    repetitions: 5,
    lapses: 0,
    nextReviewAt: "2026-12-20T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-15T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.mocked(getIdToken).mockResolvedValue("mock-firebase-id-token");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("ReadinessGauge", () => {
  it("renders readiness percentage, verdict badge, and 3 sub-score bars", () => {
    const report = makeSampleReport();

    render(<ReadinessGauge report={report} />);

    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("Almost Ready")).toBeInTheDocument();

    expect(
      screen.getByRole("progressbar", { name: "Score Proximity · 55%" })
    ).toHaveAttribute("aria-valuenow", "88");
    expect(
      screen.getByRole("progressbar", { name: "Consistency · 25%" })
    ).toHaveAttribute("aria-valuenow", "84");
    expect(
      screen.getByRole("progressbar", { name: "Pacing & Timeline · 20%" })
    ).toHaveAttribute("aria-valuenow", "63");

    expect(screen.getByText("760")).toBeInTheDocument();
    expect(screen.getByText("±18.5")).toBeInTheDocument();
    expect(screen.getByText("+25.0")).toBeInTheDocument();
  });

  it("hides sub-score breakdown when compact prop is true", () => {
    const report = makeSampleReport({
      readinessIndex: 91,
      verdict: "exam_ready",
    });

    render(<ReadinessGauge report={report} compact />);

    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("Exam Ready")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("AiCoachCard", () => {
  it("calls POST /api/ai/readiness-insight and renders examDecision and twoWeekActionPlan", async () => {
    const user = userEvent.setup();
    const mockResponse = {
      examDecision:
        "You are on track to exceed 750 within 3 weeks once Part 7 pacing is stabilized.",
      strengths: [
        "Listening Parts 1–4 consistently exceed 80% accuracy.",
        "Vocabulary retention is strong with mastered SRS cards.",
      ],
      criticalGaps: [
        "Part 7 accuracy at 65% shows time pressure on multi-passage sets.",
      ],
      twoWeekActionPlan: [
        "Complete 2 timed Part 7 double-passage drills every week.",
        "Limit Part 5 to 9 minutes per full practice test.",
        "Clear all due SRS flashcards daily before evening drills.",
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(
      <AiCoachCard
        uid="user-123"
        targetScore={750}
        targetExamDate="2026-12-20"
        report={makeSampleReport()}
        fullTests={[makeFullTest()]}
        mistakes={[makeMistake()]}
        vocabCards={[makeVocabCard()]}
      />
    );

    const button = screen.getByRole("button", {
      name: /generate ai study plan/i,
    });
    expect(button).toBeEnabled();

    await user.click(button);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const [requestUrl, requestInit] = fetchSpy.mock.calls[0];
    expect(requestUrl).toBe("/api/ai/readiness-insight");
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer mock-firebase-id-token",
    });

    expect(
      await screen.findByText(mockResponse.examDecision)
    ).toBeInTheDocument();
    expect(
      screen.getByText(mockResponse.twoWeekActionPlan[0])
    ).toBeInTheDocument();
    expect(
      screen.getByText(mockResponse.twoWeekActionPlan[1])
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /refresh ai insight/i })
    ).toBeInTheDocument();

    const cached = window.sessionStorage.getItem("speakwise_ai_coach_user-123");
    expect(cached).not.toBeNull();
  });

  it("disables generation when no tests or mistakes are logged", () => {
    render(
      <AiCoachCard
        uid="user-empty"
        targetScore={750}
        targetExamDate={null}
        report={makeSampleReport({
          totalFullTestsCount: 0,
          sampleSize: 0,
          readinessIndex: 0,
          verdict: "needs_foundation",
        })}
        fullTests={[]}
        mistakes={[]}
        vocabCards={[]}
      />
    );

    expect(
      screen.getByRole("button", { name: /generate ai study plan/i })
    ).toBeDisabled();
    expect(
      screen.getByText(/log at least one full test or mistake record/i)
    ).toBeInTheDocument();
  });
});
