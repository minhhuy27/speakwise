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

import { generateStructuredJson } from "@/lib/ai/gemini";
import {
  AuthVerifyError,
  verifyFirebaseRequest,
} from "@/lib/firebase/verify-token";
import { POST } from "@/app/api/ai/mistake-explain/route";

const mockVerifyFirebaseRequest = vi.mocked(verifyFirebaseRequest);
const mockGenerateStructuredJson = vi.mocked(generateStructuredJson);

function createJsonRequest(body: unknown, token = "valid-test-token"): Request {
  return new Request("http://localhost/api/ai/mistake-explain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/ai/mistake-explain", () => {
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

    const request = new Request("http://localhost/api/ai/mistake-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        part: 5,
        promptSnippet: "The report was submitted _____ the deadline.",
        errorCategory: "grammar",
      }),
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
        part: 9,
        promptSnippet: "   ",
        errorCategory: "invalid_category",
      })
    );
    const invalidPayloadData = (await invalidPayloadResponse.json()) as {
      error: string;
      details?: {
        fieldErrors?: {
          part?: string[];
          promptSnippet?: string[];
          errorCategory?: string[];
        };
      };
    };

    expect(invalidPayloadResponse.status).toBe(400);
    expect(invalidPayloadData.error).toBe("Invalid request payload.");
    expect(invalidPayloadData.details?.fieldErrors?.part).toBeDefined();
    expect(invalidPayloadData.details?.fieldErrors?.promptSnippet).toContain(
      "Question or trap summary is required"
    );
    expect(invalidPayloadData.details?.fieldErrors?.errorCategory).toBeDefined();
    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();
  });

  it("returns 503 when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const response = await POST(
      createJsonRequest({
        part: 2,
        promptSnippet: "Where will the budget meeting be held?",
        userAnswer: "At 2:00 PM.",
        correctAnswer: "In Conference Room B.",
        errorCategory: "listening_trap",
      })
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data).toEqual({
      error: "GEMINI_API_KEY is not configured on the server.",
    });
    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();
  });

  it("returns 200 with a validated English TOEIC explanation payload", async () => {
    mockGenerateStructuredJson.mockResolvedValueOnce({
      explanation:
        "In Part 2, 'Where' asks for a location rather than a time. 'At 2:00 PM' is a classic wh-word mismatch distractor, whereas 'In Conference Room B' directly answers the location question.",
      toeicTip:
        "Focus intensely on the very first wh-question word in Part 2 audio and immediately eliminate answers that match the wrong question type.",
      keyVocabulary: [
        "conference room",
        "budget meeting",
        "reschedule",
        "headquarters",
        "extra item beyond limit",
      ],
    });

    const response = await POST(
      createJsonRequest({
        part: 2,
        promptSnippet: "Where will the budget meeting be held?",
        userAnswer: "At 2:00 PM.",
        correctAnswer: "In Conference Room B.",
        errorCategory: "listening_trap",
      })
    );
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(mockGenerateStructuredJson).toHaveBeenCalledWith(
      expect.stringContaining("100% clear, natural English"),
      expect.objectContaining({
        type: "OBJECT",
        required: ["explanation", "toeicTip", "keyVocabulary"],
      })
    );
    expect(mockGenerateStructuredJson).toHaveBeenCalledWith(
      expect.stringContaining("Part 2 (Question-Response)"),
      expect.any(Object)
    );
    expect(data).toEqual({
      explanation:
        "In Part 2, 'Where' asks for a location rather than a time. 'At 2:00 PM' is a classic wh-word mismatch distractor, whereas 'In Conference Room B' directly answers the location question.",
      toeicTip:
        "Focus intensely on the very first wh-question word in Part 2 audio and immediately eliminate answers that match the wrong question type.",
      keyVocabulary: [
        "conference room",
        "budget meeting",
        "reschedule",
        "headquarters",
      ],
    });
  });

  it("returns 502 when Gemini fails or returns an incomplete payload", async () => {
    mockGenerateStructuredJson.mockRejectedValueOnce(
      new Error("Gemini upstream timeout")
    );

    const errorResponse = await POST(
      createJsonRequest({
        part: 7,
        promptSnippet: "Missed detail in second email attachment.",
        errorCategory: "time_pressure",
      })
    );
    expect(errorResponse.status).toBe(502);

    mockGenerateStructuredJson.mockResolvedValueOnce({
      explanation: "",
      toeicTip: "Skim the email header first.",
      keyVocabulary: [],
    });

    const incompleteResponse = await POST(
      createJsonRequest({
        part: 7,
        promptSnippet: "Missed detail in second email attachment.",
        errorCategory: "time_pressure",
      })
    );
    const incompleteData = (await incompleteResponse.json()) as { error: string };

    expect(incompleteResponse.status).toBe(502);
    expect(incompleteData).toEqual({
      error: "AI service returned an incomplete mistake explanation payload.",
    });
  });
});
