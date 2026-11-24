import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/verify-token", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/firebase/verify-token")>();
  return {
    ...actual,
    verifyFirebaseRequest: vi.fn(),
  };
});

vi.mock("@/lib/ai/gemini", () => ({
  generateStructuredJson: vi.fn(),
}));

import { POST } from "@/app/api/ai/readiness-insight/route";
import { generateStructuredJson } from "@/lib/ai/gemini";
import {
  AuthVerifyError,
  verifyFirebaseRequest,
} from "@/lib/firebase/verify-token";

const mockVerifyFirebaseRequest = vi.mocked(verifyFirebaseRequest);
const mockGenerateStructuredJson = vi.mocked(generateStructuredJson);

function createValidRequestBody() {
  return {
    targetScore: 850,
    targetExamDate: "2026-12-10",
    readinessScore: 78,
    verdict: "almost_ready",
    recentFullTests: [
      {
        title: "ETS TOEIC 2024 Test 1",
        takenAt: "2026-11-12",
        listeningScore: 430,
        readingScore: 365,
        totalScore: 795,
        durationMinutes: 126,
      },
      {
        title: "ETS TOEIC 2024 Test 2",
        takenAt: "2026-11-19",
        listeningScore: 445,
        readingScore: 380,
        totalScore: 825,
        durationMinutes: 120,
      },
    ],
    partAccuracy: {
      part1: 0.92,
      part2: 0.84,
      part3: 0.85,
      part4: 0.8,
      part5: 0.77,
      part6: 0.75,
      part7: 0.65,
    },
    topErrorCategories: [
      { category: "time_pressure", count: 12 },
      { category: "inference", count: 7 },
    ],
    vocabStats: {
      total: 280,
      mastered: 190,
      dueToday: 15,
      leechCount: 3,
    },
  };
}

function createJsonRequest(body: unknown, token = "valid-test-token"): Request {
  return new Request("http://localhost/api/ai/readiness-insight", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/ai/readiness-insight", () => {
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-api-key";
    mockVerifyFirebaseRequest.mockResolvedValue({
      uid: "user-123",
      email: "learner@example.com",
    });
  });

  afterEach(() => {
    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }
  });

  it("returns 401 when verifyFirebaseRequest throws AuthVerifyError", async () => {
    mockVerifyFirebaseRequest.mockRejectedValueOnce(
      new AuthVerifyError("Missing or invalid Authorization header.", 401)
    );

    const request = new Request("http://localhost/api/ai/readiness-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createValidRequestBody()),
    });

    const response = await POST(request);
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(data).toEqual({
      error: "Missing or invalid Authorization header.",
    });
    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON or invalid request payload", async () => {
    const malformedResponse = await POST(createJsonRequest("{bad-json"));
    expect(malformedResponse.status).toBe(400);
    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();

    const invalidPayloadResponse = await POST(
      createJsonRequest({
        ...createValidRequestBody(),
        targetScore: 1200,
        readinessScore: -5,
        verdict: "invalid_verdict",
      })
    );
    const invalidPayloadData = (await invalidPayloadResponse.json()) as {
      error: string;
      details?: {
        fieldErrors?: {
          targetScore?: string[];
          readinessScore?: string[];
          verdict?: string[];
        };
      };
    };

    expect(invalidPayloadResponse.status).toBe(400);
    expect(invalidPayloadData.error).toBe("Invalid request payload.");
    expect(invalidPayloadData.details?.fieldErrors?.targetScore).toBeDefined();
    expect(invalidPayloadData.details?.fieldErrors?.readinessScore).toBeDefined();
    expect(invalidPayloadData.details?.fieldErrors?.verdict).toBeDefined();
    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();
  });

  it("returns 503 when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const response = await POST(createJsonRequest(createValidRequestBody()));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data).toEqual({
      error: "GEMINI_API_KEY is not configured on the server.",
    });
    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();
  });

  it("returns 200 with a validated English TOEIC readiness strategy output", async () => {
    mockGenerateStructuredJson.mockResolvedValueOnce({
      examDecision:
        "Hold off on sitting the exam for 2 weeks; your 825 latest score is within 25 points of 850, so closing the Part 7 pacing gap will make your target reliable.",
      strengths: [
        "  Listening reached 430-445/495 with 92% accuracy on Part 1 and 85% on Part 3.  ",
        "Vocabulary SRS mastery stands at 68% (190/280 cards mastered).",
        "",
      ],
      criticalGaps: [
        "Part 7 accuracy is 65%, compounded by 12 time-pressure mistakes and a 126m overtime run on Test 1.",
        "7 inference errors indicate difficulty synthesizing implicit clues across multi-passage emails.",
      ],
      twoWeekActionPlan: [
        "Lock Reading section time budgets: 10 minutes for Part 5, 8 minutes for Part 6, and 57 minutes for Part 7.",
        "Complete 2 timed Part 7 double/triple-passage drills daily with post-drill inference tagging.",
        "Clear all 15 due SRS cards each morning and isolate the 3 leech words into context sentences.",
      ],
    });

    const response = await POST(createJsonRequest(createValidRequestBody()));
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(mockGenerateStructuredJson).toHaveBeenCalledWith(
      expect.stringContaining(
        "expert TOEIC Listening & Reading Exam Strategist"
      ),
      expect.objectContaining({
        type: "OBJECT",
        required: [
          "examDecision",
          "strengths",
          "criticalGaps",
          "twoWeekActionPlan",
        ],
      })
    );
    expect(mockGenerateStructuredJson).toHaveBeenCalledWith(
      expect.stringContaining("100% concise, data-backed English"),
      expect.any(Object)
    );
    expect(mockGenerateStructuredJson).toHaveBeenCalledWith(
      expect.stringContaining("[OVERTIME > 120m]"),
      expect.any(Object)
    );
    expect(mockGenerateStructuredJson).toHaveBeenCalledWith(
      expect.stringContaining("Time Pressure (time_pressure): 12 logged mistakes"),
      expect.any(Object)
    );
    expect(data).toEqual({
      examDecision:
        "Hold off on sitting the exam for 2 weeks; your 825 latest score is within 25 points of 850, so closing the Part 7 pacing gap will make your target reliable.",
      strengths: [
        "Listening reached 430-445/495 with 92% accuracy on Part 1 and 85% on Part 3.",
        "Vocabulary SRS mastery stands at 68% (190/280 cards mastered).",
      ],
      criticalGaps: [
        "Part 7 accuracy is 65%, compounded by 12 time-pressure mistakes and a 126m overtime run on Test 1.",
        "7 inference errors indicate difficulty synthesizing implicit clues across multi-passage emails.",
      ],
      twoWeekActionPlan: [
        "Lock Reading section time budgets: 10 minutes for Part 5, 8 minutes for Part 6, and 57 minutes for Part 7.",
        "Complete 2 timed Part 7 double/triple-passage drills daily with post-drill inference tagging.",
        "Clear all 15 due SRS cards each morning and isolate the 3 leech words into context sentences.",
      ],
    });
  });

  it("returns 502 when Gemini fails or returns an incomplete payload", async () => {
    mockGenerateStructuredJson.mockRejectedValueOnce(
      new Error("Gemini upstream timeout")
    );

    const errorResponse = await POST(
      createJsonRequest(createValidRequestBody())
    );
    expect(errorResponse.status).toBe(502);

    mockGenerateStructuredJson.mockResolvedValueOnce({
      examDecision: "Proceed with booking your TOEIC exam.",
      strengths: ["Strong Listening score."],
      criticalGaps: [],
      twoWeekActionPlan: ["Review Part 7 passages daily."],
    });

    const incompleteResponse = await POST(
      createJsonRequest(createValidRequestBody())
    );
    const incompleteData = (await incompleteResponse.json()) as {
      error: string;
    };

    expect(incompleteResponse.status).toBe(502);
    expect(incompleteData).toEqual({
      error: "AI service returned an incomplete readiness insight payload.",
    });
  });
});
