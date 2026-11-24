import { NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/ai/gemini";
import {
  AuthVerifyError,
  verifyFirebaseRequest,
} from "@/lib/firebase/verify-token";
import {
  ERROR_CATEGORY_LABELS,
  type MistakeExplainRequest,
  mistakeExplainRequestSchema,
  mistakeExplainResponseSchema,
} from "@/lib/validations/mistake";

const TOEIC_PART_CONTEXT: Record<number, string> = {
  1: "Part 1 (Photographs)",
  2: "Part 2 (Question-Response)",
  3: "Part 3 (Conversations)",
  4: "Part 4 (Short Talks)",
  5: "Part 5 (Incomplete Sentences)",
  6: "Part 6 (Text Completion)",
  7: "Part 7 (Reading Comprehension)",
};

const MISTAKE_EXPLAIN_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    explanation: { type: "STRING" },
    toeicTip: { type: "STRING" },
    keyVocabulary: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["explanation", "toeicTip", "keyVocabulary"],
};

function buildMistakeExplainPrompt(input: MistakeExplainRequest): string {
  const partLabel = TOEIC_PART_CONTEXT[input.part] ?? `Part ${input.part}`;
  const categoryLabel = ERROR_CATEGORY_LABELS[input.errorCategory];

  const lines = [
    "You are an expert TOEIC Listening & Reading test coach.",
    "Analyze the learner's mistake below and respond strictly in 100% clear, natural English.",
    "Do NOT include any non-English words or translations in your response.",
    "",
    `TOEIC Section: ${partLabel}`,
    `Error Category: ${categoryLabel} (${input.errorCategory})`,
    `Question / Trap Summary: "${input.promptSnippet}"`,
  ];

  if (input.userAnswer && input.userAnswer.length > 0) {
    lines.push(`Learner's Answer: "${input.userAnswer}"`);
  }
  if (input.correctAnswer && input.correctAnswer.length > 0) {
    lines.push(`Correct Answer: "${input.correctAnswer}"`);
  }

  lines.push(
    "",
    "Respond strictly with a JSON object containing these exact fields:",
    `- "explanation": concise, accurate English explanation of why the mistake happened and why the correct answer works in TOEIC ${partLabel}, addressing the ${categoryLabel} error category.`,
    `- "toeicTip": one actionable, practical English strategy tip for avoiding this ${categoryLabel} trap in TOEIC ${partLabel}.`,
    '- "keyVocabulary": array of up to 4 high-value English TOEIC words or collocations relevant to this question (or [] if none apply).'
  );

  return lines.join("\n");
}

function normalizeStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
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

  const parsedRequest = mistakeExplainRequestSchema.safeParse(rawBody);
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

  const prompt = buildMistakeExplainPrompt(parsedRequest.data);

  try {
    const aiRaw = await generateStructuredJson(
      prompt,
      MISTAKE_EXPLAIN_RESPONSE_SCHEMA
    );

    if (!aiRaw || typeof aiRaw !== "object" || Array.isArray(aiRaw)) {
      return NextResponse.json(
        { error: "AI service returned an invalid mistake explanation payload." },
        { status: 502 }
      );
    }

    const aiRecord = aiRaw as Record<string, unknown>;
    const candidate = {
      explanation: aiRecord.explanation,
      toeicTip: aiRecord.toeicTip,
      keyVocabulary: normalizeStringList(aiRecord.keyVocabulary, 4),
    };

    const validated = mistakeExplainResponseSchema.safeParse(candidate);
    if (!validated.success) {
      return NextResponse.json(
        {
          error:
            "AI service returned an incomplete mistake explanation payload.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate mistake explanation with AI service." },
      { status: 502 }
    );
  }
}
