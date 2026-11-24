"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Info, Plus, Settings } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { AiCoachCard } from "@/components/readiness/ai-coach-card";
import { ErrorCategoryChart } from "@/components/readiness/error-category-chart";
import { PartAccuracyChart } from "@/components/readiness/part-accuracy-chart";
import { ReadinessGauge } from "@/components/readiness/readiness-gauge";
import { ScoreTrendChart } from "@/components/readiness/score-trend-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluateExamReadiness } from "@/lib/engines/readiness";
import { subscribeAllUserMistakes } from "@/lib/firebase/repositories/mistakes";
import { subscribeUserTests } from "@/lib/firebase/repositories/tests";
import { subscribeUserVocab } from "@/lib/firebase/repositories/vocab";
import { daysUntilDate } from "@/lib/utils";
import type { MistakeRecord, TestAttempt, VocabCard } from "@/types/domain";

function ReadinessPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

export default function ReadinessPage() {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? null;

  const [tests, setTests] = React.useState<TestAttempt[]>([]);
  const [mistakes, setMistakes] = React.useState<MistakeRecord[]>([]);
  const [vocabCards, setVocabCards] = React.useState<VocabCard[]>([]);
  const [loadedFlags, setLoadedFlags] = React.useState({
    tests: false,
    mistakes: false,
    vocab: false,
  });

  React.useEffect(() => {
    if (!uid) {
      setTests([]);
      setMistakes([]);
      setVocabCards([]);
      setLoadedFlags({ tests: true, mistakes: true, vocab: true });
      return;
    }

    setLoadedFlags({ tests: false, mistakes: false, vocab: false });

    const unsubTests = subscribeUserTests(
      uid,
      (nextTests) => {
        setTests(nextTests);
        setLoadedFlags((prev) => ({ ...prev, tests: true }));
      },
      () => {
        setLoadedFlags((prev) => ({ ...prev, tests: true }));
      }
    );

    const unsubMistakes = subscribeAllUserMistakes(
      uid,
      (nextMistakes) => {
        setMistakes(nextMistakes);
        setLoadedFlags((prev) => ({ ...prev, mistakes: true }));
      },
      () => {
        setLoadedFlags((prev) => ({ ...prev, mistakes: true }));
      }
    );

    const unsubVocab = subscribeUserVocab(
      uid,
      (nextVocab) => {
        setVocabCards(nextVocab);
        setLoadedFlags((prev) => ({ ...prev, vocab: true }));
      },
      () => {
        setLoadedFlags((prev) => ({ ...prev, vocab: true }));
      }
    );

    return () => {
      unsubTests();
      unsubMistakes();
      unsubVocab();
    };
  }, [uid]);

  const targetScore = profile?.targetScore ?? 750;
  const targetExamDate = profile?.targetExamDate ?? null;
  const daysRemaining = daysUntilDate(targetExamDate);

  const report = React.useMemo(
    () =>
      evaluateExamReadiness(
        tests,
        targetScore,
        targetExamDate,
        new Date(),
        tests
      ),
    [tests, targetScore, targetExamDate]
  );

  const fullTests = React.useMemo(
    () => tests.filter((test) => test.mode === "full_test"),
    [tests]
  );

  const isLoading =
    !loadedFlags.tests || !loadedFlags.mistakes || !loadedFlags.vocab;

  if (isLoading) {
    return <ReadinessPageSkeleton />;
  }

  const remainingForConfidence = Math.max(0, 3 - report.totalFullTestsCount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Exam Readiness
          </h1>
          <p className="text-sm text-muted-foreground">
            Evaluate mock test consistency, Part-by-Part accuracy, and pacing
            relative to your{" "}
            <span className="font-mono font-medium tabular-nums text-foreground">
              {targetScore}
            </span>{" "}
            goal
            {daysRemaining !== null && daysRemaining >= 0 ? (
              <span className="font-mono tabular-nums">
                {" "}
                ({daysRemaining} {daysRemaining === 1 ? "day" : "days"} left)
              </span>
            ) : null}
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span>Exam Goals</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/tests">
              <Plus className="h-4 w-4" />
              <span>Log Test</span>
            </Link>
          </Button>
        </div>
      </div>

      {report.totalFullTestsCount < 3 ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <div>
              {report.totalFullTestsCount === 0 ? (
                <p>
                  <span className="font-medium">No Full Tests logged yet.</span>{" "}
                  Log your first 200-question TOEIC practice test to calculate
                  your Readiness Index and score trajectory.
                </p>
              ) : (
                <p>
                  <span className="font-medium">Preliminary estimate shown</span>{" "}
                  — Log{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    {remainingForConfidence}
                  </span>{" "}
                  more Full {remainingForConfidence === 1 ? "Test" : "Tests"} to
                  unlock high-confidence readiness analysis.
                </p>
              )}
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/tests">
              <span>
                {report.totalFullTestsCount === 0
                  ? "Log First Full Test"
                  : "Open Test Log"}
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Readiness Index Breakdown</CardTitle>
          <CardDescription>
            Weighted across Score Proximity (55%), Score Consistency (25%), and
            Pacing &amp; Exam Timeline (20%).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReadinessGauge report={report} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Full Test Score Trajectory</CardTitle>
            <CardDescription>
              Total, Listening, and Reading scores across your recent full-length
              tests versus your{" "}
              <span className="font-mono tabular-nums">{targetScore}</span>{" "}
              target.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart fullTests={fullTests} targetScore={targetScore} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Part-by-Part Accuracy</CardTitle>
            <CardDescription>
              Cumulative accuracy across TOEIC Parts 1–7 from all logged tests
              and drills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PartAccuracyChart
              partAccuracies={report.partAccuracies}
              weakParts={report.weakParts}
              targetScore={targetScore}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Error Category Breakdown</CardTitle>
          <CardDescription>
            Distribution of root-cause mistake tags across{" "}
            <span className="font-mono tabular-nums">{mistakes.length}</span>{" "}
            logged {mistakes.length === 1 ? "mistake" : "mistakes"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorCategoryChart mistakes={mistakes} />
        </CardContent>
      </Card>

      {uid ? (
        <AiCoachCard
          uid={uid}
          targetScore={targetScore}
          targetExamDate={targetExamDate}
          report={report}
          fullTests={fullTests}
          mistakes={mistakes}
          vocabCards={vocabCards}
        />
      ) : null}
    </div>
  );
}
