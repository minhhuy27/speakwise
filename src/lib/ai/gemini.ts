import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.6-flash";

/**
 * Returns a server-only GoogleGenAI SDK client configured with GEMINI_API_KEY.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  return new GoogleGenAI({ apiKey });
}

function stripMarkdownCodeFences(rawText: string): string {
  const trimmed = rawText.trim();
  const match = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i.exec(trimmed);
  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Generates structured JSON output from Gemini using JSON response mode and
 * optional OpenAPI/JSON schema constraints.
 */
export async function generateStructuredJson(
  prompt: string,
  responseSchema?: Record<string, unknown>
): Promise<unknown> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
      ...(responseSchema ? { responseSchema } : {}),
    },
  });

  const text = response.text;
  if (!text || !text.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  const cleaned = stripMarkdownCodeFences(text);
  return JSON.parse(cleaned) as unknown;
}
