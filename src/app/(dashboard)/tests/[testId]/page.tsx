"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { MistakeFormDialog } from "@/components/tests/mistake-form-dialog";
import { TestLoggerDialog } from "@/components/tests/test-logger-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VocabFormDialog,
  type VocabFormPrefill,
} from "@/components/vocab/vocab-form-dialog";
import { getIdToken } from "@/lib/firebase/auth";
import {
  createMistakeRecord,
  deleteMistakeRecord,
  subscribeMistakesByTest,
  updateMistakeRecord,
} from "@/lib/firebase/repositories/mistakes";
import {
  subscribeTestAttempt,
  updateTestAttempt,
} from "@/lib/firebase/repositories/tests";
import { createVocabCard } from "@/lib/firebase/repositories/vocab";
import { cn } from "@/lib/utils";
import {
  ERROR_CATEGORIES,
  ERROR_CATEGORY_LABELS,
  type MistakeExplainResponse,
  type MistakeFormValues,
} from "@/lib/validations/mistake";
import { TOEIC_PART_KEYS, type TestAttemptFormValues } from "@/lib/validations/test";
import type { VocabCardFormValues } from "@/lib/validations/vocab";
import type {
  ErrorCategory,
  MistakeRecord,
  TestAttempt,
  ToeicPartKey,
} from "@/types/domain";

const PART_NAMES: Record<ToeicPartKey, string> = {
  part1: "Part 1 · Photographs",
  part2: "Part 2 · Question-Response",
  part3: "Part 3 · Conversations",
  part4: "Part 4 · Short Talks",
  part5: "Part 5 · Incomplete Sentences",
  part6: "Part 6 · Text Completion",
  part7: "Part 7 · Reading Comprehension",
};

const TOEIC_PARTS = [1, 2, 3, 4, 5, 6, 7] as const;

type SemanticStatus = "danger" | "warning" | "info" | "success";

function getAccuracySemantic(pct: number): {
  status: SemanticStatus;
  badgeVariant: SemanticStatus;
  barClass: string;
  textClass: string;
} {
  if (pct < 60) {
    return {
      status: "danger",
      badgeVariant: "danger",
      barClass: "bg-danger",
      textClass: "text-danger",
    };
  }
  if (pct < 75) {
    return {
      status: "warning",
      badgeVariant: "warning",
      barClass: "bg-warning",
      textClass: "text-warning",
    };
  }
  if (pct < 85) {
    return {
      status: "info",
      badgeVariant: "info",
      barClass: "bg-info",
      textClass: "text-info",
    };
  }
  return {
    status: "success",
    badgeVariant: "success",
    barClass: "bg-success",
    textClass: "text-success",
  };
}

function getCategoryBadgeVariant(
  category: ErrorCategory
): "danger" | "warning" | "info" | "secondary" | "outline" {
  switch (category) {
    case "time_pressure":
      return "danger";
    case "listening_trap":
      return "warning";
    case "vocab":
    case "inference":
      return "info";
    case "grammar":
      return "secondary";
    case "careless":
      return "outline";
  }
}

function computeOverallAccuracy(test: TestAttempt): {
  correct: number;
  total: number;
  accuracy: number;
} {
  let correct = 0;
  let total = 0;
  for (const part of Object.values(test.parts)) {
    if (!part) continue;
    correct += part.correct;
    total += part.total;
  }
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, accuracy };
}

function TestDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-36 rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}

export default function TestDetailPage() {
  const params = useParams<{ testId: string }>();
  const testId = params?.testId;
  const { user } = useAuth();

  const [test, setTest] = React.useState<TestAttempt | null>(null);
  const [mistakes, setMistakes] = React.useState<MistakeRecord[]>([]);
  const [loadingTest, setLoadingTest] = React.useState(true);
  const [loadingMistakes, setLoadingMistakes] = React.useState(true);

  const [categoryFilter, setCategoryFilter] = React.useState<
    "all" | ErrorCategory
  >("all");
  const [partFilter, setPartFilter] = React.useState<"all" | number>("all");

  const [testDialogOpen, setTestDialogOpen] = React.useState(false);
  const [mistakeDialogOpen, setMistakeDialogOpen] = React.useState(false);
  const [editingMistake, setEditingMistake] =
    React.useState<MistakeRecord | null>(null);
  const [deletingMistake, setDeletingMistake] =
    React.useState<MistakeRecord | null>(null);
  const [isDeletingMistake, setIsDeletingMistake] = React.useState(false);

  const [explainingIds, setExplainingIds] = React.useState<
    Record<string, boolean>
  >({});
  const [aiInsightsByMistake, setAiInsightsByMistake] = React.useState<
    Record<string, MistakeExplainResponse>
  >({});

  const [vocabDialogOpen, setVocabDialogOpen] = React.useState(false);
  const [vocabPrefill, setVocabPrefill] = React.useState<
    VocabFormPrefill | undefined
  >(undefined);
  const [srsTargetMistake, setSrsTargetMistake] =
    React.useState<MistakeRecord | null>(null);

  React.useEffect(() => {
    if (!user || !testId) return;

    setLoadingTest(true);
    setLoadingMistakes(true);

    const unsubTest = subscribeTestAttempt(
      user.uid,
      testId,
      (nextTest) => {
        setTest(nextTest);
        setLoadingTest(false);
      },
      (error) => {
        console.error("Failed to subscribe to test attempt:", error);
        toast.error("Failed to load test details.");
        setLoadingTest(false);
      }
    );

    const unsubMistakes = subscribeMistakesByTest(
      user.uid,
      testId,
      (nextMistakes) => {
        setMistakes(nextMistakes);
        setLoadingMistakes(false);
      },
      (error) => {
        console.error("Failed to subscribe to test mistakes:", error);
        toast.error("Failed to load test mistakes.");
        setLoadingMistakes(false);
      }
    );

    return () => {
      unsubTest();
      unsubMistakes();
    };
  }, [user, testId]);

  const filteredMistakes = React.useMemo(() => {
    return mistakes.filter((mistake) => {
      if (
        categoryFilter !== "all" &&
        mistake.errorCategory !== categoryFilter
      ) {
        return false;
      }
      if (partFilter !== "all" && mistake.part !== partFilter) {
        return false;
      }
      return true;
    });
  }, [mistakes, categoryFilter, partFilter]);

  const handleUpdateTest = async (values: TestAttemptFormValues) => {
    if (!user || !test) return;

    try {
      await updateTestAttempt(user.uid, test.id, values);
      toast.success(`Updated "${values.title.trim()}".`);
    } catch (error) {
      console.error("Failed to update test attempt:", error);
      toast.error("Failed to update test attempt.");
      throw error;
    }
  };

  const handleOpenAddMistake = () => {
    setEditingMistake(null);
    setMistakeDialogOpen(true);
  };

  const handleOpenEditMistake = (mistake: MistakeRecord) => {
    setEditingMistake(mistake);
    setMistakeDialogOpen(true);
  };

  const handleSubmitMistake = async (values: MistakeFormValues) => {
    if (!user || !test) return;

    try {
      if (editingMistake) {
        await updateMistakeRecord(user.uid, editingMistake.id, values);
        toast.success("Mistake record updated.");
      } else {
        await createMistakeRecord(
          user.uid,
          { id: test.id, title: test.title },
          values
        );
        toast.success("Mistake logged.");
      }
    } catch (error) {
      console.error("Failed to save mistake record:", error);
      toast.error("Failed to save mistake record.");
      throw error;
    }
  };

  const handleConfirmDeleteMistake = async () => {
    if (!user || !test || !deletingMistake) return;

    setIsDeletingMistake(true);
    try {
      await deleteMistakeRecord(user.uid, test.id, deletingMistake.id);
      toast.success("Mistake deleted.");
      setDeletingMistake(null);
    } catch (error) {
      console.error("Failed to delete mistake:", error);
      toast.error("Failed to delete mistake.");
    } finally {
      setIsDeletingMistake(false);
    }
  };

  const handleInlineExplain = async (mistake: MistakeRecord) => {
    if (!user) return;

    setExplainingIds((prev) => ({ ...prev, [mistake.id]: true }));
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Authentication session expired. Please sign in again.");
        return;
      }

      const response = await fetch("/api/ai/mistake-explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          part: mistake.part,
          promptSnippet: mistake.promptSnippet,
          ...(mistake.userAnswer ? { userAnswer: mistake.userAnswer } : {}),
          ...(mistake.correctAnswer
            ? { correctAnswer: mistake.correctAnswer }
            : {}),
          errorCategory: mistake.errorCategory,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (MistakeExplainResponse & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("explanation" in payload)) {
        const message =
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Failed to generate AI explanation.";
        toast.error(message);
        return;
      }

      setAiInsightsByMistake((prev) => ({
        ...prev,
        [mistake.id]: payload,
      }));

      await updateMistakeRecord(user.uid, mistake.id, {
        explanation: payload.explanation,
      });
      toast.success("AI explanation saved.");
    } catch {
      toast.error("Failed to generate AI explanation.");
    } finally {
      setExplainingIds((prev) => ({ ...prev, [mistake.id]: false }));
    }
  };

  const handleOpenSaveToSrs = (
    mistake: MistakeRecord,
    selectedWord?: string
  ) => {
    if (!test) return;

    setSrsTargetMistake(mistake);
    setVocabPrefill({
      word: selectedWord || mistake.extractedWord || "",
      contextSentence: mistake.promptSnippet,
      sourceTestId: test.id,
      sourceMistakeId: mistake.id,
      tags: [`Part ${mistake.part}`, test.source],
    });
    setVocabDialogOpen(true);
  };

  const handleSubmitVocabCard = async (values: VocabCardFormValues) => {
    if (!user || !srsTargetMistake) return;

    try {
      const card = await createVocabCard(user.uid, values);
      await updateMistakeRecord(user.uid, srsTargetMistake.id, {
        linkedVocabId: card.id,
      });
      toast.success(`Saved "${card.displayWord}" to SRS deck.`);
    } catch (error) {
      console.error("Failed to save vocabulary card from mistake:", error);
      toast.error("Failed to save vocabulary card.");
      throw error;
    }
  };

  if (loadingTest || loadingMistakes) {
    return <TestDetailSkeleton />;
  }

  if (!test) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tests">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Test Log</span>
          </Link>
        </Button>

        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <h1 className="text-lg font-semibold text-foreground">
              Test attempt not found
            </h1>
            <p className="text-sm text-muted-foreground">
              This test attempt may have been deleted or does not exist.
            </p>
            <Button asChild variant="outline">
              <Link href="/tests">Return to Test Log</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFull = test.mode === "full_test";
  const isOvertime = isFull && test.durationMinutes > 120;
  const overall = computeOverallAccuracy(test);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/tests">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Test Log</span>
          </Link>
        </Button>
      </div>

      {/* Test Summary Header */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {test.title}
                </h1>
                <Badge variant="secondary">{test.source}</Badge>
                <Badge variant={isFull ? "info" : "outline"}>
                  {isFull ? "Full Test" : "Part Drill"}
                </Badge>
                {test.isManualScoreOverride ? (
                  <Badge variant="outline">Manual Override</Badge>
                ) : null}
                {isOvertime ? <Badge variant="danger">Overtime</Badge> : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">{test.takenAt}</span>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                  <Clock className="h-3.5 w-3.5" />
                  {test.durationMinutes} min
                </span>
                <span className="font-mono tabular-nums">
                  {mistakes.length}{" "}
                  {mistakes.length === 1 ? "mistake" : "mistakes"} logged
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTestDialogOpen(true)}
              >
                <Pencil className="h-4 w-4" />
                <span>Edit Test</span>
              </Button>
              <Button type="button" onClick={handleOpenAddMistake}>
                <Plus className="h-4 w-4" />
                <span>+ Log Mistake</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
            {isFull ? (
              <>
                <div className="rounded-md border border-border bg-muted/40 px-3.5 py-2 font-mono text-sm font-semibold text-foreground tabular-nums">
                  Listening: {test.listeningScore}/495 · Reading:{" "}
                  {test.readingScore}/495 · Total:{" "}
                  <span className="text-primary">{test.totalScore} / 990</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  Raw: L {test.listeningCorrect}/100 · R {test.readingCorrect}
                  /100 ({overall.accuracy}% overall)
                </span>
              </>
            ) : (
              <Badge
                variant={getAccuracySemantic(overall.accuracy).badgeVariant}
                className="px-3.5 py-1.5 font-mono text-sm tabular-nums"
              >
                Accuracy: {overall.correct} / {overall.total} (
                {overall.accuracy}%)
              </Badge>
            )}
          </div>

          {test.reflectionNote ? (
            <div className="rounded-md border border-border/70 bg-muted/30 px-3.5 py-2.5">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">
                Reflection Note
              </p>
              <p className="text-sm text-foreground whitespace-pre-line">
                {test.reflectionNote}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Part 1-7 Accuracy Breakdown Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Part 1–7 Accuracy Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TOEIC_PART_KEYS.map((partKey) => {
              const partScore = test.parts[partKey];
              if (!partScore) {
                return (
                  <div
                    key={partKey}
                    className="rounded-md border border-border/60 bg-muted/20 p-3.5 opacity-60"
                  >
                    <p className="text-xs font-semibold text-muted-foreground">
                      {PART_NAMES[partKey]}
                    </p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      Not included
                    </p>
                  </div>
                );
              }

              const pct =
                partScore.total > 0
                  ? Math.round((partScore.correct / partScore.total) * 100)
                  : 0;
              const semantic = getAccuracySemantic(pct);

              return (
                <div
                  key={partKey}
                  className="rounded-md border border-border bg-card p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {PART_NAMES[partKey]}
                    </span>
                    <Badge
                      variant={semantic.badgeVariant}
                      className="font-mono text-[11px] tabular-nums"
                    >
                      {pct}%
                    </Badge>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span
                      className={cn(
                        "font-mono text-lg font-bold tabular-nums",
                        semantic.textClass
                      )}
                    >
                      {partScore.correct}/{partScore.total}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {partScore.total - partScore.correct} missed
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        semantic.barClass
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mistake Log Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Mistake Log
            </h2>
            <p className="text-sm text-muted-foreground">
              Review missed questions, generate AI coaching tips, and save key
              vocabulary directly to SRS.
            </p>
          </div>

          <Button type="button" size="sm" onClick={handleOpenAddMistake}>
            <Plus className="h-4 w-4" />
            <span>+ Log Mistake</span>
          </Button>
        </div>

        {/* Mistake Filters */}
        {mistakes.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground mr-1">
                Category:
              </span>
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                aria-pressed={categoryFilter === "all"}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  categoryFilter === "all"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                All
              </button>
              {ERROR_CATEGORIES.map((category) => {
                const isSelected = categoryFilter === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      setCategoryFilter(isSelected ? "all" : category)
                    }
                    aria-pressed={isSelected}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {ERROR_CATEGORY_LABELS[category]}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground mr-1">
                Part:
              </span>
              <button
                type="button"
                onClick={() => setPartFilter("all")}
                aria-pressed={partFilter === "all"}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  partFilter === "all"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                All Parts
              </button>
              {TOEIC_PARTS.map((partNum) => {
                const isSelected = partFilter === partNum;
                return (
                  <button
                    key={partNum}
                    type="button"
                    onClick={() => setPartFilter(isSelected ? "all" : partNum)}
                    aria-pressed={isSelected}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium transition-colors tabular-nums",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Part {partNum}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Mistakes List */}
        {mistakes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  No mistakes logged for this test yet
                </h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  Log missed questions to uncover recurring error categories and
                  turn unfamiliar vocabulary into SRS flashcards.
                </p>
              </div>
              <Button type="button" size="sm" onClick={handleOpenAddMistake}>
                <Plus className="h-4 w-4" />
                <span>+ Log First Mistake</span>
              </Button>
            </CardContent>
          </Card>
        ) : filteredMistakes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center space-y-3">
              <p className="text-sm font-medium text-foreground">
                No mistakes match the selected part or category filter.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCategoryFilter("all");
                  setPartFilter("all");
                }}
              >
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredMistakes.map((mistake) => {
              const isExplaining = Boolean(explainingIds[mistake.id]);
              const aiInsight = aiInsightsByMistake[mistake.id];

              return (
                <Card
                  key={mistake.id}
                  className="transition-colors hover:border-primary/30"
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="font-mono tabular-nums"
                        >
                          Part {mistake.part}
                        </Badge>
                        {mistake.questionNumber !== undefined ? (
                          <Badge
                            variant="secondary"
                            className="font-mono tabular-nums"
                          >
                            Q{mistake.questionNumber}
                          </Badge>
                        ) : null}
                        <Badge
                          variant={getCategoryBadgeVariant(
                            mistake.errorCategory
                          )}
                        >
                          {ERROR_CATEGORY_LABELS[mistake.errorCategory]}
                        </Badge>
                        {mistake.extractedWord ? (
                          <Badge variant="outline" className="font-medium">
                            Word: {mistake.extractedWord}
                          </Badge>
                        ) : null}
                        {mistake.linkedVocabId ? (
                          <Link
                            href="/vocab"
                            className="inline-flex items-center"
                          >
                            <Badge variant="success" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Saved to SRS
                            </Badge>
                          </Link>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditMistake(mistake)}
                          aria-label={`Edit Part ${mistake.part} mistake`}
                        >
                          <Pencil className="h-4 w-4" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingMistake(mistake)}
                          aria-label={`Delete Part ${mistake.part} mistake`}
                          className="text-muted-foreground hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-foreground whitespace-pre-line">
                      {mistake.promptSnippet}
                    </p>

                    {mistake.userAnswer || mistake.correctAnswer ? (
                      <div className="flex flex-wrap gap-3 text-xs">
                        {mistake.userAnswer ? (
                          <div className="rounded border border-danger/30 bg-danger/10 px-2.5 py-1 text-danger">
                            <span className="font-semibold">Your Answer: </span>
                            <span>{mistake.userAnswer}</span>
                          </div>
                        ) : null}
                        {mistake.correctAnswer ? (
                          <div className="rounded border border-success/30 bg-success/10 px-2.5 py-1 text-success">
                            <span className="font-semibold">
                              Correct Answer:{" "}
                            </span>
                            <span>{mistake.correctAnswer}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {mistake.explanation ? (
                      <div className="rounded-md border border-border/70 bg-muted/30 px-3.5 py-2.5 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Explanation
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-line">
                          {mistake.explanation}
                        </p>
                      </div>
                    ) : null}

                    {aiInsight ? (
                      <div className="rounded-md border border-primary/25 bg-primary/5 px-3.5 py-2.5 space-y-2">
                        <p className="text-xs font-semibold text-primary">
                          TOEIC Strategy Tip
                        </p>
                        <p className="text-sm text-foreground">
                          {aiInsight.toeicTip}
                        </p>
                        {aiInsight.keyVocabulary.length > 0 ? (
                          <div className="space-y-1 pt-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              Key Vocabulary (click to save to SRS):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {aiInsight.keyVocabulary.map((word) => (
                                <button
                                  key={word}
                                  type="button"
                                  onClick={() =>
                                    handleOpenSaveToSrs(mistake, word)
                                  }
                                  className="rounded-full border border-primary/30 bg-card px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/10"
                                >
                                  + {word}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleInlineExplain(mistake)}
                        disabled={isExplaining}
                      >
                        {isExplaining ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span>
                          {isExplaining ? "Explaining..." : "Explain with AI"}
                        </span>
                      </Button>

                      {mistake.linkedVocabId ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href="/vocab">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            <span>Saved to SRS · Open Vocab</span>
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSaveToSrs(mistake)}
                        >
                          <BookPlus className="h-3.5 w-3.5" />
                          <span>+ Save to SRS</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Test Dialog */}
      <TestLoggerDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        editingTest={test}
        onSubmitTest={handleUpdateTest}
      />

      {/* Add / Edit Mistake Dialog */}
      <MistakeFormDialog
        open={mistakeDialogOpen}
        onOpenChange={setMistakeDialogOpen}
        editingMistake={editingMistake}
        onSubmitMistake={handleSubmitMistake}
      />

      {/* Save to SRS Dialog */}
      <VocabFormDialog
        open={vocabDialogOpen}
        onOpenChange={(open) => {
          setVocabDialogOpen(open);
          if (!open) {
            setSrsTargetMistake(null);
            setVocabPrefill(undefined);
          }
        }}
        prefill={vocabPrefill}
        onSubmitCard={handleSubmitVocabCard}
      />

      {/* Delete Mistake Confirmation */}
      <Dialog
        open={Boolean(deletingMistake)}
        onOpenChange={(open) => {
          if (!open && !isDeletingMistake) {
            setDeletingMistake(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Mistake Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this Part{" "}
              {deletingMistake?.part} mistake record? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingMistake(null)}
              disabled={isDeletingMistake}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDeleteMistake()}
              disabled={isDeletingMistake}
            >
              {isDeletingMistake ? "Deleting..." : "Delete Mistake"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
