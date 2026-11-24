"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  Layers,
  Plus,
  Settings,
  Target,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { ReadinessGauge } from "@/components/readiness/readiness-gauge";
import { ScoreTrendChart } from "@/components/readiness/score-trend-chart";
import { Badge } from "@/components/ui/badge";
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
import { buildDailyStudyQueue } from "@/lib/engines/srs";
import { subscribeAllUserMistakes } from "@/lib/firebase/repositories/mistakes";
import { subscribeUserTests } from "@/lib/firebase/repositories/tests";
import { subscribeUserVocab } from "@/lib/firebase/repositories/vocab";
import { daysUntilDate } from "@/lib/utils";
import { ERROR_CATEGORY_LABELS } from "@/lib/validations/mistake";
import type { MistakeRecord, TestAttempt, VocabCard } from "@/types/domain";

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { profile, user } = useAuth();
  const uid = user?.uid ?? null;

  const [tests, setTests] = React.useState<TestAttempt[]>([]);
  const [vocabCards, setVocabCards] = React.useState<VocabCard[]>([]);
  const [mistakes, setMistakes] = React.useState<MistakeRecord[]>([]);
  const [loadedFlags, setLoadedFlags] = React.useState({
    tests: false,
    vocab: false,
    mistakes: false,
  });

  React.useEffect(() => {
    if (!uid) {
      setTests([]);
      setVocabCards([]);
      setMistakes([]);
      setLoadedFlags({ tests: true, vocab: true, mistakes: true });
      return;
    }

    setLoadedFlags({ tests: false, vocab: false, mistakes: false });

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

    return () => {
      unsubTests();
      unsubVocab();
      unsubMistakes();
    };
  }, [uid]);

  const displayName =
    profile?.displayName || user?.displayName || "TOEIC Learner";
  const targetScore = profile?.targetScore ?? 750;
  const dailyLimit = profile?.dailyNewWordsLimit ?? 15;
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

  const dailyQueue = React.useMemo(
    () => buildDailyStudyQueue(vocabCards, dailyLimit),
    [vocabCards, dailyLimit]
  );

  const fullTests = React.useMemo(
    () => tests.filter((test) => test.mode === "full_test"),
    [tests]
  );

  const masteredCount = React.useMemo(
    () => vocabCards.filter((card) => card.status === "mastered").length,
    [vocabCards]
  );

  const latestVocab = React.useMemo(() => vocabCards.slice(0, 4), [vocabCards]);
  const recentMistakes = React.useMemo(() => mistakes.slice(0, 4), [mistakes]);

  const isLoading =
    !loadedFlags.tests || !loadedFlags.vocab || !loadedFlags.mistakes;

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  const currentForm =
    report.sampleSize > 0 ? Math.round(report.weightedAverage) : null;
  const scoreGap = currentForm !== null ? currentForm - targetScore : null;
  const queueTotal = dailyQueue.queue.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {displayName}. Here is your live TOEIC L&amp;R study
            snapshot.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            <span>Study Goals</span>
          </Link>
        </Button>
      </div>

      <section
        aria-label="Study hero metrics"
        className="grid gap-4 md:grid-cols-3"
      >
        {/* Card 1: Target vs. Current Form */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Target vs. Current Form</CardDescription>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-wrap items-baseline gap-2 pt-1">
              <CardTitle className="text-3xl font-bold font-mono tabular-nums">
                {currentForm !== null ? currentForm : "—"}
              </CardTitle>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                / {targetScore}
              </span>
              {scoreGap !== null ? (
                <Badge
                  variant={scoreGap >= 0 ? "success" : "warning"}
                  className="font-mono tabular-nums"
                >
                  {scoreGap >= 0 ? `+${scoreGap}` : scoreGap} pts
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-info" />
                Exam countdown
              </span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {daysRemaining !== null
                  ? daysRemaining >= 0
                    ? `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`
                    : "Date passed"
                  : "Not scheduled"}
              </span>
            </div>
            <Button asChild variant="ghost" size="sm" className="px-0 text-primary">
              <Link href="/settings">
                <span>Configure target &amp; date</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Today's SRS Queue */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Today&apos;s SRS Queue</CardDescription>
              <Layers className="h-4 w-4 text-success" />
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <CardTitle className="text-3xl font-bold font-mono tabular-nums">
                {queueTotal}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {queueTotal === 1 ? "card ready" : "cards ready"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono tabular-nums">
              <span>{dailyQueue.dueCards.length} due</span>
              <span>&middot;</span>
              <span>{dailyQueue.newCards.length} new</span>
              <span>&middot;</span>
              <span className="text-success">{masteredCount} mastered</span>
            </div>
            {queueTotal > 0 ? (
              <Button asChild size="sm" className="w-full">
                <Link href="/vocab/review">
                  <span>Review Now ({queueTotal} {queueTotal === 1 ? "card" : "cards"})</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href="/vocab">
                  <span>All Caught Up — Open Vocab</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Exam Readiness Preview */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardDescription>Exam Readiness Preview</CardDescription>
              <Badge variant="outline" className="font-mono tabular-nums">
                {report.totalFullTestsCount}{" "}
                {report.totalFullTestsCount === 1 ? "test" : "tests"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-between gap-2 pt-0">
            <ReadinessGauge report={report} compact />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="px-0 text-primary"
            >
              <Link href="/readiness">
                <span>Open Readiness Analytics</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Recent activity" className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Recent Score Trend</CardTitle>
              <CardDescription>
                Latest full-length mock test scores against your{" "}
                <span className="font-mono tabular-nums">{targetScore}</span>{" "}
                target.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/tests">
                <span>Open Test Log</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart
              fullTests={fullTests}
              targetScore={targetScore}
              mini
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Latest Vocabulary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-lg">Latest Vocabulary</CardTitle>
                <CardDescription>
                  Recently added TOEIC cards in your SRS bank.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/vocab?add=1">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Word</span>
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {latestVocab.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No vocabulary cards yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add your first TOEIC business word to start spaced
                    repetition reviews.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {latestVocab.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">
                          {card.displayWord}
                        </span>
                        <Badge variant="secondary" className="text-[11px]">
                          {card.partOfSpeech}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-foreground">
                        {card.meaningEn}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {card.meaningVi}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Mistakes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-lg">Recent Mistakes</CardTitle>
                <CardDescription>
                  Latest missed questions logged from your mock tests.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/tests">
                  <span>View Tests</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentMistakes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No mistakes logged yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Record missed questions inside a test attempt to track
                    recurring traps.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentMistakes.map((mistake) => (
                    <Link
                      key={mistake.id}
                      href={`/tests/${mistake.testId}`}
                      className="block rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                          Part {mistake.part}
                          {mistake.questionNumber
                            ? ` · Q${mistake.questionNumber}`
                            : ""}
                        </span>
                        <Badge variant="outline" className="text-[11px]">
                          {ERROR_CATEGORY_LABELS[mistake.errorCategory]}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {mistake.promptSnippet}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
