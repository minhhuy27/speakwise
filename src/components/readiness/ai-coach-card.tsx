"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReadinessReport } from "@/lib/engines/readiness";
import { buildDailyStudyQueue, isLeechCard } from "@/lib/engines/srs";
import { getIdToken } from "@/lib/firebase/auth";
import { ERROR_CATEGORIES } from "@/lib/validations/mistake";
import {
  type ReadinessInsightRequest,
  type ReadinessInsightResponse,
  readinessInsightResponseSchema,
} from "@/lib/validations/readiness";
import type {
  ErrorCategory,
  MistakeRecord,
  TestAttempt,
  ToeicPartKey,
  VocabCard,
} from "@/types/domain";

interface AiCoachCardProps {
  uid: string;
  targetScore: number;
  targetExamDate: string | null;
  report: ReadinessReport;
  fullTests: TestAttempt[];
  mistakes: MistakeRecord[];
  vocabCards: VocabCard[];
}

const ALL_PARTS: readonly ToeicPartKey[] = [
  "part1",
  "part2",
  "part3",
  "part4",
  "part5",
  "part6",
  "part7",
];

function getCoachCacheKey(uid: string): string {
  return `speakwise_ai_coach_${uid}`;
}

function compareIsoStrings(a: string, b: string): number {
  const timeA = Date.parse(a);
  const timeB = Date.parse(b);
  if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function buildInsightPayload(
  props: Omit<AiCoachCardProps, "uid">
): ReadinessInsightRequest {
  const {
    targetScore,
    targetExamDate,
    report,
    fullTests,
    mistakes,
    vocabCards,
  } = props;

  const recentFullTests = [...fullTests]
    .filter((test) => test.mode === "full_test")
    .sort((a, b) => {
      const takenCmp = compareIsoStrings(a.takenAt, b.takenAt);
      if (takenCmp !== 0) return takenCmp;
      const createdCmp = compareIsoStrings(a.createdAt, b.createdAt);
      if (createdCmp !== 0) return createdCmp;
      return a.id.localeCompare(b.id);
    })
    .slice(-5)
    .map((test) => ({
      title: test.title,
      takenAt: test.takenAt,
      listeningScore: test.listeningScore,
      readingScore: test.readingScore,
      totalScore: test.totalScore,
      durationMinutes: test.durationMinutes,
    }));

  const partAccuracy = {} as ReadinessInsightRequest["partAccuracy"];
  for (const part of ALL_PARTS) {
    partAccuracy[part] = report.partAccuracies[part]?.accuracy ?? null;
  }

  const categoryCounts = new Map<ErrorCategory, number>();
  for (const category of ERROR_CATEGORIES) {
    categoryCounts.set(category, 0);
  }
  for (const mistake of mistakes) {
    categoryCounts.set(
      mistake.errorCategory,
      (categoryCounts.get(mistake.errorCategory) ?? 0) + 1
    );
  }

  const topErrorCategories = ERROR_CATEGORIES.map((category) => ({
    category,
    count: categoryCounts.get(category) ?? 0,
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const dueToday = buildDailyStudyQueue(vocabCards, 0).dueCards.length;
  const mastered = vocabCards.filter(
    (card) => card.status === "mastered"
  ).length;
  const leechCount = vocabCards.filter(isLeechCard).length;

  return {
    targetScore,
    targetExamDate,
    readinessScore: report.readinessIndex,
    verdict: report.verdict,
    recentFullTests,
    partAccuracy,
    topErrorCategories,
    vocabStats: {
      total: vocabCards.length,
      mastered,
      dueToday,
      leechCount,
    },
  };
}

export function AiCoachCard({
  uid,
  targetScore,
  targetExamDate,
  report,
  fullTests,
  mistakes,
  vocabCards,
}: AiCoachCardProps) {
  const [insight, setInsight] = React.useState<ReadinessInsightResponse | null>(
    null
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(getCoachCacheKey(uid));
      if (!raw) {
        setInsight(null);
        return;
      }
      const parsed = readinessInsightResponseSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        setInsight(parsed.data);
      } else {
        setInsight(null);
      }
    } catch {
      setInsight(null);
    }
  }, [uid]);

  const hasSufficientData = fullTests.length > 0 || mistakes.length > 0;

  const handleGenerateInsight = React.useCallback(async () => {
    if (!hasSufficientData || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error(
          "Your session expired. Please sign in again to generate AI insights."
        );
      }

      const payload = buildInsightPayload({
        targetScore,
        targetExamDate,
        report,
        fullTests,
        mistakes,
        vocabCards,
      });

      const response = await fetch("/api/ai/readiness-insight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = (await response.json().catch(() => null)) as
        | { error?: string }
        | ReadinessInsightResponse
        | null;

      if (!response.ok) {
        const message =
          json && "error" in json && typeof json.error === "string"
            ? json.error
            : "Failed to generate AI readiness insight.";
        throw new Error(message);
      }

      const validated = readinessInsightResponseSchema.safeParse(json);
      if (!validated.success) {
        throw new Error("Received an invalid AI readiness insight response.");
      }

      setInsight(validated.data);
      try {
        window.sessionStorage.setItem(
          getCoachCacheKey(uid),
          JSON.stringify(validated.data)
        );
      } catch {
        // Ignore sessionStorage quota or privacy mode errors.
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to generate AI readiness insight right now.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    fullTests,
    hasSufficientData,
    loading,
    mistakes,
    report,
    targetExamDate,
    targetScore,
    uid,
    vocabCards,
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>AI Exam Readiness Coach</CardTitle>
          </div>
          <CardDescription>
            Personalized TOEIC strategist insights grounded in your mock scores,
            Part accuracy, error logs, and SRS retention.
          </CardDescription>
        </div>

        <Button
          type="button"
          onClick={handleGenerateInsight}
          disabled={!hasSufficientData || loading}
          variant={insight ? "outline" : "default"}
          className="shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : insight ? (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Refresh AI Insight</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Generate AI Study Plan</span>
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasSufficientData ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            Log at least one Full Test or mistake record to unlock your
            personalized AI readiness diagnosis and 2-week study plan.
          </p>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3.5 text-sm text-danger sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleGenerateInsight}
              disabled={loading}
              className="self-start border-danger/40 text-danger hover:bg-danger/10 sm:self-auto"
            >
              Retry
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4" aria-label="Generating AI study plan">
            <Skeleton className="h-20 w-full rounded-lg" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : insight ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Target className="h-4 w-4" />
                <span>Exam Decision</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                {insight.examDecision}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Key Strengths</span>
                </div>
                <ul className="mt-2.5 space-y-2 text-sm text-foreground">
                  {insight.strengths.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Critical Gaps</span>
                </div>
                <ul className="mt-2.5 space-y-2 text-sm text-foreground">
                  {insight.criticalGaps.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-info">
                <ListChecks className="h-4 w-4" />
                <span>2-Week Action Plan</span>
              </div>
              <ol className="mt-3 space-y-2.5 text-sm text-foreground">
                {insight.twoWeekActionPlan.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold tabular-nums text-primary">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : hasSufficientData ? (
          <p className="text-sm text-muted-foreground">
            Click{" "}
            <span className="font-medium text-foreground">
              Generate AI Study Plan
            </span>{" "}
            to receive an exam-registration recommendation and a focused 14-day
            TOEIC preparation roadmap.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
