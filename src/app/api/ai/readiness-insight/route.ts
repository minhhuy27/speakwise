import { NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/ai/gemini";
import {
  AuthVerifyError,
  verifyFirebaseRequest,
} from "@/lib/firebase/verify-token";
import { daysUntilDate } from "@/lib/utils";
import { ERROR_CATEGORY_LABELS } from "@/lib/validations/mistake";
import {
  READINESS_VERDICT_LABELS,
  type ReadinessInsightRequest,
  readinessInsightRequestSchema,
  readinessInsightResponseSchema,
} from "@/lib/validations/readiness";
import type { ToeicPartKey } from "@/types/domain";

const TOEIC_PART_KEYS: readonly ToeicPartKey[] = [
  "part1",
  "part2",
  "part3",
  "part4",
  "part5",
  "part6",
  "part7",
];

const TOEIC_PART_LABELS: Record<ToeicPartKey, string> = {
  part1: "Part 1 (Photographs)",
  part2: "Part 2 (Question-Response)",
  part3: "Part 3 (Conversations)",
  part4: "Part 4 (Short Talks)",
  part5: "Part 5 (Incomplete Sentences)",
  part6: "Part 6 (Text Completion)",
  part7: "Part 7 (Reading Comprehension)",
};

const READINESS_INSIGHT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    examDecision: { type: "STRING" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    criticalGaps: { type: "ARRAY", items: { type: "STRING" } },
    twoWeekActionPlan: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "examDecision",
    "strengths",
    "criticalGaps",
    "twoWeekActionPlan",
  ],
};

function formatTimelineSummary(targetExamDate: string | null | undefined): string {
  if (!targetExamDate) {
    return "Not set";
  }

  const daysRemaining = daysUntilDate(targetExamDate);
  if (daysRemaining === null) {
    return targetExamDate;
  }
  if (daysRemaining < 0) {
    return `${targetExamDate} (${Math.abs(daysRemaining)} days overdue)`;
  }
  return `${targetExamDate} (${daysRemaining} days remaining)`;
}

function buildReadinessInsightPrompt(input: ReadinessInsightRequest): string {
  const verdictLabel = READINESS_VERDICT_LABELS[input.verdict];
  const timelineSummary = formatTimelineSummary(input.targetExamDate);

  const testLines =
    input.recentFullTests.length > 0
      ? input.recentFullTests.map((test) => {
          const overtimeTag =
            test.durationMinutes > 120 ? " [OVERTIME > 120m]" : "";
          const dateLabel = test.takenAt.length > 0 ? test.takenAt : "Undated";
          return `- ${dateLabel} | ${test.title}: Total ${test.totalScore}/990 (Listening ${test.listeningScore}/495, Reading ${test.readingScore}/495), Duration ${test.durationMinutes}m${overtimeTag}`;
        })
      : ["- No full-length TOEIC practice tests logged yet."];

  const partLines = TOEIC_PART_KEYS.map((partKey) => {
    const accuracy = input.partAccuracy[partKey];
    const accuracyDisplay =
      typeof accuracy === "number" ? `${Math.round(accuracy * 100)}%` : "No data";
    return `- ${TOEIC_PART_LABELS[partKey]}: ${accuracyDisplay}`;
  });

  const errorLines =
    input.topErrorCategories.length > 0
      ? input.topErrorCategories.map(
          (entry) =>
            `- ${ERROR_CATEGORY_LABELS[entry.category]} (${entry.category}): ${entry.count} logged mistakes`
        )
      : ["- No mistake records logged yet."];

  const { total, mastered, dueToday, leechCount } = input.vocabStats;
  const masteryRate = total > 0 ? `${Math.round((mastered / total) * 100)}%` : "0%";
  const leechSegment =
    typeof leechCount === "number" ? `, Leech words (lapses >= 4): ${leechCount}` : "";

  return [
    "You are an expert TOEIC Listening & Reading Exam Strategist.",
    "Evaluate the learner's exam readiness telemetry below and respond strictly in 100% concise, data-backed English.",
    "Do NOT include any non-English words, translations, or markdown formatting inside JSON values.",
    "",
    "### Learner Readiness Telemetry",
    `- Target TOEIC Score: ${input.targetScore}/990`,
    `- Target Exam Date: ${timelineSummary}`,
    `- Readiness Index: ${input.readinessScore}/100 (${verdictLabel})`,
    `- Vocabulary SRS: ${total} total cards, ${mastered} mastered (${masteryRate}), ${dueToday} due today${leechSegment}`,
    "",
    "### Recent Full Tests (up to 10)",
    ...testLines,
    "",
    "### Part-by-Part Accuracy",
    ...partLines,
    "",
    "### Top Mistake Categories",
    ...errorLines,
    "",
    "Respond strictly with a JSON object containing these exact fields:",
    '- "examDecision": Direct 1-2 sentence exam registration recommendation grounded in the target gap, score stability across recent full tests, and remaining days until the exam.',
    '- "strengths": Array of 1 to 3 concrete, data-backed strengths observed from Listening/Reading scores, Part accuracies, or SRS vocabulary mastery.',
    '- "criticalGaps": Array of 1 to 3 highest-impact bottlenecks citing specific weak Parts, overtime pacing (> 120m), top error categories, or timeline pressure.',
    '- "twoWeekActionPlan": Array of 2 to 4 concrete, measurable actions for the next 2 weeks covering time allocation across Parts 5/6/7, targeted Part drills, and daily SRS review queue targets.',
  ].join("\n");
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

  const parsedRequest = readinessInsightRequestSchema.safeParse(rawBody);
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

  const prompt = buildReadinessInsightPrompt(parsedRequest.data);

  try {
    const aiRaw = await generateStructuredJson(
      prompt,
      READINESS_INSIGHT_RESPONSE_SCHEMA
    );

    if (!aiRaw || typeof aiRaw !== "object" || Array.isArray(aiRaw)) {
      return NextResponse.json(
        { error: "AI service returned an invalid readiness insight payload." },
        { status: 502 }
      );
    }

    const aiRecord = aiRaw as Record<string, unknown>;
    const candidate = {
      examDecision: aiRecord.examDecision,
      strengths: normalizeStringList(aiRecord.strengths, 5),
      criticalGaps: normalizeStringList(aiRecord.criticalGaps, 5),
      twoWeekActionPlan: normalizeStringList(aiRecord.twoWeekActionPlan, 6),
    };

    const validated = readinessInsightResponseSchema.safeParse(candidate);
    if (!validated.success) {
      return NextResponse.json(
        {
          error:
            "AI service returned an incomplete readiness insight payload.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate readiness insight with AI service." },
      { status: 502 }
    );
  }
}
