"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Clock,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { TestLoggerDialog } from "@/components/tests/test-logger-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createTestAttempt,
  deleteTestAttempt,
  subscribeUserTests,
  updateTestAttempt,
} from "@/lib/firebase/repositories/tests";
import { cn } from "@/lib/utils";
import type { TestAttemptFormValues } from "@/lib/validations/test";
import type { TestAttempt, TestMode } from "@/types/domain";

type ModeFilter = "all" | TestMode;

const MODE_TABS: readonly { value: ModeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "full_test", label: "Full Tests" },
  { value: "mini_or_part", label: "Part Drills" },
];

function computeMiniSummary(test: TestAttempt): {
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

function getAccuracyBadgeVariant(
  accuracy: number
): "danger" | "warning" | "info" | "success" {
  if (accuracy < 60) return "danger";
  if (accuracy < 75) return "warning";
  if (accuracy < 85) return "info";
  return "success";
}

function TestsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}

export default function TestsPage() {
  const { user, profile } = useAuth();
  const targetScore = profile?.targetScore ?? 750;

  const [tests, setTests] = React.useState<TestAttempt[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [modeFilter, setModeFilter] = React.useState<ModeFilter>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTest, setEditingTest] = React.useState<TestAttempt | null>(null);
  const [deletingTest, setDeletingTest] = React.useState<TestAttempt | null>(
    null
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubscribe = subscribeUserTests(
      user.uid,
      (nextTests) => {
        setTests(nextTests);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to subscribe to tests:", error);
        toast.error("Failed to load test attempts.");
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  const metrics = React.useMemo(() => {
    const fullTests = tests.filter((test) => test.mode === "full_test");
    const latestFull = fullTests[0] ?? null;
    const bestFullScore =
      fullTests.length > 0
        ? Math.max(...fullTests.map((test) => test.totalScore))
        : null;
    const totalMistakes = tests.reduce(
      (sum, test) => sum + (test.mistakeCount ?? 0),
      0
    );
    const latestDelta = latestFull
      ? latestFull.totalScore - targetScore
      : null;

    return {
      fullTestCount: fullTests.length,
      latestFullScore: latestFull ? latestFull.totalScore : null,
      latestDelta,
      bestFullScore,
      totalMistakes,
    };
  }, [tests, targetScore]);

  const filteredTests = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tests.filter((test) => {
      if (modeFilter !== "all" && test.mode !== modeFilter) {
        return false;
      }

      if (query) {
        const matchesTitle = test.title.toLowerCase().includes(query);
        const matchesSource = test.source.toLowerCase().includes(query);
        if (!matchesTitle && !matchesSource) {
          return false;
        }
      }

      return true;
    });
  }, [tests, modeFilter, searchQuery]);

  const handleOpenCreate = () => {
    setEditingTest(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (test: TestAttempt) => {
    setEditingTest(test);
    setDialogOpen(true);
  };

  const handleSubmitTest = async (values: TestAttemptFormValues) => {
    if (!user) return;

    try {
      if (editingTest) {
        await updateTestAttempt(user.uid, editingTest.id, values);
        toast.success(`Updated "${values.title.trim()}".`);
      } else {
        await createTestAttempt(user.uid, values);
        toast.success(`Logged "${values.title.trim()}".`);
      }
    } catch (error) {
      console.error("Failed to save test attempt:", error);
      toast.error("Failed to save test attempt. Please try again.");
      throw error;
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingTest) return;

    setIsDeleting(true);
    try {
      await deleteTestAttempt(user.uid, deletingTest.id);
      toast.success(`Deleted "${deletingTest.title}" and its mistake log.`);
      setDeletingTest(null);
    } catch (error) {
      console.error("Failed to delete test attempt:", error);
      toast.error("Failed to delete test attempt.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <TestsPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            TOEIC Test Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Track full mock simulations, part drills, and part-by-part accuracy
            against your{" "}
            <span className="font-mono font-semibold text-foreground tabular-nums">
              {targetScore}
            </span>{" "}
            target.
          </p>
        </div>

        <Button type="button" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          <span>+ Log Test Attempt</span>
        </Button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Full Tests
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {metrics.fullTestCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Latest Full Score
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <p className="font-mono text-2xl font-bold tracking-tight text-primary tabular-nums">
                {metrics.latestFullScore !== null
                  ? metrics.latestFullScore
                  : "—"}
              </p>
              {metrics.latestDelta !== null ? (
                <span
                  className={cn(
                    "font-mono text-xs font-medium tabular-nums",
                    metrics.latestDelta >= 0 ? "text-success" : "text-warning"
                  )}
                >
                  {metrics.latestDelta >= 0
                    ? `+${metrics.latestDelta}`
                    : metrics.latestDelta}{" "}
                  vs {targetScore}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Best Full Score
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-success tabular-nums">
              {metrics.bestFullScore !== null ? metrics.bestFullScore : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Logged Mistakes
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {metrics.totalMistakes}
            </p>
          </CardContent>
        </Card>
      </div>

      {tests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">
                No test attempts logged yet — Log your first TOEIC test
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Record full 200-question simulations or targeted part drills to
                calculate ETS scaled scores and build your mistake review log.
              </p>
            </div>
            <Button type="button" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              <span>+ Log Test Attempt</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search & Mode Filters */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search test title or source..."
                aria-label="Search test attempts"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div
              className="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Filter test attempts by mode"
            >
              {MODE_TABS.map((tab) => {
                const isActive = modeFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setModeFilter(tab.value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredTests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">
                  No test attempts match your current search or filter.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setModeFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTests.map((test) => {
                const isFull = test.mode === "full_test";
                const isOvertime = isFull && test.durationMinutes > 120;
                const miniSummary = !isFull ? computeMiniSummary(test) : null;

                return (
                  <Card
                    key={test.id}
                    className="transition-colors hover:border-primary/30"
                  >
                    <CardContent className="p-5 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold tracking-tight text-foreground">
                              {test.title}
                            </h2>
                            <Badge variant="secondary">{test.source}</Badge>
                            <Badge variant={isFull ? "info" : "outline"}>
                              {isFull ? "Full Test" : "Part Drill"}
                            </Badge>
                            {isOvertime ? (
                              <Badge variant="danger">Overtime</Badge>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-mono tabular-nums">
                              {test.takenAt}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Clock className="h-3.5 w-3.5" />
                              {test.durationMinutes} min
                            </span>
                            <span className="font-mono tabular-nums">
                              {test.mistakeCount}{" "}
                              {test.mistakeCount === 1 ? "mistake" : "mistakes"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isFull ? (
                            <div className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-sm font-semibold text-foreground tabular-nums">
                              L: {test.listeningScore} · R: {test.readingScore}{" "}
                              · Total:{" "}
                              <span className="text-primary">
                                {test.totalScore} / 990
                              </span>
                            </div>
                          ) : miniSummary ? (
                            <Badge
                              variant={getAccuracyBadgeVariant(
                                miniSummary.accuracy
                              )}
                              className="px-3 py-1 font-mono text-sm tabular-nums"
                            >
                              {miniSummary.correct} / {miniSummary.total} (
                              {miniSummary.accuracy}%)
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      {test.reflectionNote ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {test.reflectionNote}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/tests/${test.id}`}>
                            <span>View Details &amp; Mistakes</span>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(test)}
                            aria-label={`Edit ${test.title}`}
                          >
                            <Pencil className="h-4 w-4" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingTest(test)}
                            aria-label={`Delete ${test.title}`}
                            className="text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <TestLoggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingTest={editingTest}
        onSubmitTest={handleSubmitTest}
      />

      <Dialog
        open={Boolean(deletingTest)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeletingTest(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Test Attempt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deletingTest?.title}
              </span>
              ? This will permanently remove the test attempt and all associated
              mistake records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingTest(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
