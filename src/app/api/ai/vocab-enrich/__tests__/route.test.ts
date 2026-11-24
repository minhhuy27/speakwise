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
import { POST } from "@/app/api/ai/vocab-enrich/route";

const mockVerifyFirebaseRequest = vi.mocked(verifyFirebaseRequest);
const mockGenerateStructuredJson = vi.mocked(generateStructuredJson);

function createJsonRequest(body: unknown, token = "valid-test-token"): Request {
  return new Request("http://localhost/api/ai/vocab-enrich", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/ai/vocab-enrich", () => {
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-api-key";
    mockVerifyFirebaseRequest.mockResolvedValue({
      uid: "user-123",
      email: "learner@example.com",
    });
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    const request = new Request("http://localhost/api/ai/vocab-enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: "contract" }),
    });

    const response = await POST(request);
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(data).toEqual({
      error: "Missing or invalid Authorization header.",
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid request body or malformed JSON", async () => {
    const malformedRequest = createJsonRequest("{invalid-json");
    const malformedResponse = await POST(malformedRequest);

    expect(malformedResponse.status).toBe(400);
    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();

    const emptyWordRequest = createJsonRequest({ word: "   " });
    const emptyWordResponse = await POST(emptyWordRequest);
    const emptyWordData = (await emptyWordResponse.json()) as {
      error: string;
      details?: { fieldErrors?: { word?: string[] } };
    };

    expect(emptyWordResponse.status).toBe(400);
    expect(emptyWordData.error).toBe("Invalid request payload.");
    expect(emptyWordData.details?.fieldErrors?.word).toContain(
      "Word is required"
    );
  });

  it("returns 503 when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const response = await POST(createJsonRequest({ word: "contract" }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data).toEqual({
      error: "GEMINI_API_KEY is not configured on the server.",
    });
  });

  it("returns 200 merging Dictionary .mp3 audio and IPA with Gemini bilingual response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          word: "contract",
          phonetics: [
            {
              text: "/ˈkɑːn.trækt/",
              audio:
                "https://api.dictionaryapi.dev/media/pronunciations/en/contract-uk.mp3",
            },
            {
              text: "/ˈkɑːn.trækt/",
              audio:
                "//api.dictionaryapi.dev/media/pronunciations/en/contract-us.mp3",
            },
          ],
        },
      ],
    });

    mockGenerateStructuredJson.mockResolvedValueOnce({
      displayWord: "contract",
      ipa: "/ˈkɒn.trækt/",
      partOfSpeech: "noun",
      meaningEn: "A formal written business agreement enforceable by law",
      meaningVi: "Hợp đồng, giao kèo",
      exampleEn:
        "Both parties signed the annual supply contract before the deadline.",
      exampleVi:
        "Cả hai bên đã ký hợp đồng cung ứng thường niên trước thời hạn.",
      wordFamily: ["contractual", "contractor", "subcontract"],
      collocations: ["sign a contract", "renew a contract", "breach of contract"],
      suggestedTags: ["Contracts", "Operations"],
    });

    const response = await POST(
      createJsonRequest({
        word: "Contract",
        contextSentence: "Both parties signed the annual supply contract.",
      })
    );
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/contract",
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(mockGenerateStructuredJson).toHaveBeenCalledWith(
      expect.stringContaining("Both parties signed the annual supply contract."),
      expect.any(Object)
    );
    expect(data).toEqual({
      displayWord: "contract",
      ipa: "/ˈkɑːn.trækt/",
      audioUrl:
        "https://api.dictionaryapi.dev/media/pronunciations/en/contract-us.mp3",
      partOfSpeech: "noun",
      meaningEn: "A formal written business agreement enforceable by law",
      meaningVi: "Hợp đồng, giao kèo",
      exampleEn:
        "Both parties signed the annual supply contract before the deadline.",
      exampleVi:
        "Cả hai bên đã ký hợp đồng cung ứng thường niên trước thời hạn.",
      wordFamily: ["contractual", "contractor", "subcontract"],
      collocations: ["sign a contract", "renew a contract", "breach of contract"],
      suggestedTags: ["Contracts", "Operations"],
    });
  });

  it("returns 200 with graceful fallback when Dictionary API returns 404 for a multi-word TOEIC phrase", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ title: "No Definitions Found" }),
    });

    mockGenerateStructuredJson.mockResolvedValueOnce({
      displayWord: "in accordance with",
      ipa: "/ɪn əˈkɔːr.dəns wɪð/",
      partOfSpeech: "phrase",
      meaningEn: "In a manner conforming with a policy, rule, or agreement",
      meaningVi: "Theo đúng, tuân theo",
      exampleEn:
        "Travel reimbursements are processed in accordance with company guidelines.",
      exampleVi:
        "Các khoản hoàn trả chi phí công tác được xử lý theo đúng quy định của công ty.",
      wordFamily: ["accord", "accordance"],
      collocations: ["in accordance with regulations", "in accordance with policy"],
      suggestedTags: ["Contracts", "Office"],
    });

    const response = await POST(
      createJsonRequest({ word: "in accordance with" })
    );
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/in%20accordance%20with",
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(data).toEqual({
      displayWord: "in accordance with",
      ipa: "/ɪn əˈkɔːr.dəns wɪð/",
      audioUrl: null,
      partOfSpeech: "phrase",
      meaningEn: "In a manner conforming with a policy, rule, or agreement",
      meaningVi: "Theo đúng, tuân theo",
      exampleEn:
        "Travel reimbursements are processed in accordance with company guidelines.",
      exampleVi:
        "Các khoản hoàn trả chi phí công tác được xử lý theo đúng quy định của công ty.",
      wordFamily: ["accord", "accordance"],
      collocations: ["in accordance with regulations", "in accordance with policy"],
      suggestedTags: ["Contracts", "Office"],
    });
  });

  it("returns 502 when Gemini structured generation rejects", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    mockGenerateStructuredJson.mockRejectedValueOnce(
      new Error("Gemini upstream error")
    );

    const response = await POST(createJsonRequest({ word: "procurement" }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(data).toEqual({
      error: "Failed to enrich vocabulary with AI service.",
    });
  });
});
