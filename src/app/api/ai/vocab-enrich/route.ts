import { NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/ai/gemini";
import { AuthVerifyError, verifyFirebaseRequest } from "@/lib/firebase/verify-token";
import {
  ALLOWED_PARTS_OF_SPEECH,
  vocabEnrichRequestSchema,
  vocabEnrichResponseSchema,
} from "@/lib/validations/vocab";

const DICTIONARY_API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";
const DICTIONARY_TIMEOUT_MS = 5000;

interface DictionaryPhonetic {
  text?: unknown;
  audio?: unknown;
}

interface DictionaryApiEntry {
  phonetic?: unknown;
  phonetics?: unknown;
}

interface DictionaryLookupResult {
  ipa: string;
  audioUrl: string | null;
}

const VOCAB_ENRICH_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    displayWord: { type: "STRING" },
    ipa: { type: "STRING" },
    partOfSpeech: { type: "STRING" },
    meaningEn: { type: "STRING" },
    meaningVi: { type: "STRING" },
    exampleEn: { type: "STRING" },
    exampleVi: { type: "STRING" },
    wordFamily: { type: "ARRAY", items: { type: "STRING" } },
    collocations: { type: "ARRAY", items: { type: "STRING" } },
    suggestedTags: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "displayWord",
    "ipa",
    "partOfSpeech",
    "meaningEn",
    "meaningVi",
    "exampleEn",
    "exampleVi",
    "wordFamily",
    "collocations",
    "suggestedTags",
  ],
};

function normalizeHttpsAudioUrl(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const withProtocol = trimmed.startsWith("//")
    ? `https:${trimmed}`
    : trimmed;

  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function selectBestIpa(entries: DictionaryApiEntry[]): string {
  for (const entry of entries) {
    if (typeof entry.phonetic === "string" && entry.phonetic.trim().length > 0) {
      return entry.phonetic.trim();
    }
  }

  for (const entry of entries) {
    if (!Array.isArray(entry.phonetics)) {
      continue;
    }
    for (const item of entry.phonetics) {
      if (item && typeof item === "object") {
        const text = (item as DictionaryPhonetic).text;
        if (typeof text === "string" && text.trim().length > 0) {
          return text.trim();
        }
      }
    }
  }

  return "";
}

function selectBestAudioUrl(entries: DictionaryApiEntry[]): string | null {
  const candidates: string[] = [];

  for (const entry of entries) {
    if (!Array.isArray(entry.phonetics)) {
      continue;
    }
    for (const item of entry.phonetics) {
      if (item && typeof item === "object") {
        const normalized = normalizeHttpsAudioUrl(
          (item as DictionaryPhonetic).audio
        );
        if (normalized) {
          candidates.push(normalized);
        }
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const usMp3 = candidates.find((url) => /-us\.mp3(?:$|\?)/i.test(url));
  if (usMp3) {
    return usMp3;
  }

  const anyMp3 = candidates.find((url) => /\.mp3(?:$|\?)/i.test(url));
  return anyMp3 ?? candidates[0] ?? null;
}

async function fetchDictionaryEntry(
  word: string
): Promise<DictionaryLookupResult> {
  try {
    const url = `${DICTIONARY_API_BASE}/${encodeURIComponent(word.toLowerCase())}`;
    const signal =
      typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(DICTIONARY_TIMEOUT_MS)
        : undefined;

    const response = await fetch(url, signal ? { signal } : undefined);
    if (!response.ok) {
      return { ipa: "", audioUrl: null };
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return { ipa: "", audioUrl: null };
    }

    const entries = data.filter(
      (item): item is DictionaryApiEntry =>
        typeof item === "object" && item !== null
    );

    return {
      ipa: selectBestIpa(entries),
      audioUrl: selectBestAudioUrl(entries),
    };
  } catch {
    return { ipa: "", audioUrl: null };
  }
}

function buildVocabEnrichPrompt(
  word: string,
  contextSentence?: string
): string {
  const contextInstruction =
    contextSentence && contextSentence.length > 0
      ? `Incorporate or adapt this user context sentence naturally into "exampleEn": "${contextSentence}".`
      : `Create a realistic TOEIC Listening & Reading business or workplace sentence for "exampleEn".`;

  return [
    "You are an expert bilingual TOEIC Listening & Reading vocabulary coach for Vietnamese learners.",
    `Enrich the English word or phrase: "${word}".`,
    contextInstruction,
    "Respond strictly with a JSON object containing these exact fields:",
    '- "displayWord": standard display form of the word or phrase',
    '- "ipa": American English IPA in slashes (e.g. "/ˈkɑːn.trækt/"), or "" if not applicable for a long phrase',
    `- "partOfSpeech": primary part of speech in this business context (prefer one of: ${ALLOWED_PARTS_OF_SPEECH.join(", ")})`,
    '- "meaningEn": concise English definition in a TOEIC business/workplace context',
    '- "meaningVi": accurate, natural Vietnamese meaning for bilingual comprehension',
    '- "exampleEn": realistic TOEIC business/workplace example sentence',
    '- "exampleVi": accurate Vietnamese translation of exampleEn',
    '- "wordFamily": array of up to 5 related English word forms (or [])',
    '- "collocations": array of up to 5 high-frequency TOEIC business collocations (or [])',
    '- "suggestedTags": array of 1 to 3 concise TOEIC topic tags such as "Contracts", "Finance", "Office", "Marketing", "Travel", "HR", or "Operations"',
  ].join("\n");
}

function normalizeStringList(value: unknown, maxItems?: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return typeof maxItems === "number" ? cleaned.slice(0, maxItems) : cleaned;
}

export async function POST(request: Request) {
  try {
    await verifyFirebaseRequest(request);
  } catch (err) {
    if (err instanceof AuthVerifyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Authentication failed." },
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsedRequest = vocabEnrichRequestSchema.safeParse(rawBody);
  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 }
    );
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  const { word, contextSentence } = parsedRequest.data;
  const prompt = buildVocabEnrichPrompt(word, contextSentence);

  try {
    const [dictSettled, geminiSettled] = await Promise.allSettled([
      fetchDictionaryEntry(word),
      generateStructuredJson(prompt, VOCAB_ENRICH_RESPONSE_SCHEMA),
    ]);

    const dictResult: DictionaryLookupResult =
      dictSettled.status === "fulfilled"
        ? dictSettled.value
        : { ipa: "", audioUrl: null };

    if (geminiSettled.status === "rejected") {
      return NextResponse.json(
        { error: "Failed to enrich vocabulary with AI service." },
        { status: 502 }
      );
    }

    const aiRaw = geminiSettled.value;
    if (!aiRaw || typeof aiRaw !== "object" || Array.isArray(aiRaw)) {
      return NextResponse.json(
        { error: "AI service returned an invalid vocabulary payload." },
        { status: 502 }
      );
    }

    const aiRecord = aiRaw as Record<string, unknown>;
    const aiIpa = typeof aiRecord.ipa === "string" ? aiRecord.ipa.trim() : "";

    const mergedCandidate = {
      displayWord: aiRecord.displayWord,
      ipa: dictResult.ipa || aiIpa,
      audioUrl: dictResult.audioUrl,
      partOfSpeech: aiRecord.partOfSpeech,
      meaningEn: aiRecord.meaningEn,
      meaningVi: aiRecord.meaningVi,
      exampleEn: aiRecord.exampleEn,
      exampleVi: aiRecord.exampleVi,
      wordFamily: normalizeStringList(aiRecord.wordFamily, 5),
      collocations: normalizeStringList(aiRecord.collocations, 5),
      suggestedTags: normalizeStringList(aiRecord.suggestedTags, 3),
    };

    const validated = vocabEnrichResponseSchema.safeParse(mergedCandidate);
    if (!validated.success) {
      return NextResponse.json(
        { error: "AI service returned an incomplete vocabulary payload." },
        { status: 502 }
      );
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to enrich vocabulary with AI service." },
      { status: 502 }
    );
  }
}
