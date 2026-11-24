"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LISTENING_PARTS,
  PART_MAX_QUESTIONS,
  READING_PARTS,
  estimateToeicScore,
  summarizePartScores,
} from "@/lib/engines/score-converter";
import { cn } from "@/lib/utils";
import {
  TOEIC_PART_KEYS,
  testAttemptFormSchema,
  type TestAttemptFormValues,
} from "@/lib/validations/test";
import type {
  PartScore,
  TestAttempt,
  TestMode,
  ToeicPartKey,
} from "@/types/domain";

const SOURCE_PRESETS = ["ETS", "Hacker", "Study4", "YBM"] as const;

const PART_LABELS: Record<ToeicPartKey, string> = {
  part1: "Part 1",
  part2: "Part 2",
  part3: "Part 3",
  part4: "Part 4",
  part5: "Part 5",
  part6: "Part 6",
  part7: "Part 7",
};

const PART_SUBTITLES: Record<ToeicPartKey, string> = {
  part1: "Photographs",
  part2: "Q-Response",
  part3: "Conversations",
  part4: "Short Talks",
  part5: "Incomplete Sent.",
  part6: "Text Completion",
  part7: "Reading Comp.",
};

export interface TestLoggerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTest?: TestAttempt | null;
  onSubmitTest: (values: TestAttemptFormValues) => Promise<void>;
}

interface PartInputState {
  enabled: boolean;
  correct: string;
  total: string;
}

interface FormState {
  mode: TestMode;
  title: string;
  source: string;
  takenAt: string;
  durationMinutes: string;
  parts: Record<ToeicPartKey, PartInputState>;
  isManualScoreOverride: boolean;
  manualListeningScore: string;
  manualReadingScore: string;
  reflectionNote: string;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildInitialState(editingTest?: TestAttempt | null): FormState {
  const parts = {} as Record<ToeicPartKey, PartInputState>;

  for (const key of TOEIC_PART_KEYS) {
    const existing = editingTest?.parts?.[key];
    parts[key] = {
      enabled: Boolean(existing),
      correct: existing ? String(existing.correct) : "0",
      total: existing
        ? String(existing.total)
        : String(PART_MAX_QUESTIONS[key]),
    };
  }

  if (editingTest) {
    return {
      mode: editingTest.mode,
      title: editingTest.title,
      source: editingTest.source,
      takenAt: editingTest.takenAt,
      durationMinutes: String(editingTest.durationMinutes),
      parts,
      isManualScoreOverride: editingTest.isManualScoreOverride,
      manualListeningScore: editingTest.isManualScoreOverride
        ? String(editingTest.listeningScore)
        : "",
      manualReadingScore: editingTest.isManualScoreOverride
        ? String(editingTest.readingScore)
        : "",
      reflectionNote: editingTest.reflectionNote ?? "",
    };
  }

  return {
    mode: "full_test",
    title: "",
    source: "ETS",
    takenAt: getTodayIsoDate(),
    durationMinutes: "120",
    parts,
    isManualScoreOverride: false,
    manualListeningScore: "",
    manualReadingScore: "",
    reflectionNote: "",
  };
}

function parseNonNegativeInt(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

export function TestLoggerDialog({
  open,
  onOpenChange,
  editingTest,
  onSubmitTest,
}: TestLoggerDialogProps) {
  const [form, setForm] = React.useState<FormState>(() =>
    buildInitialState(editingTest)
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(buildInitialState(editingTest));
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open, editingTest]);

  const clearError = (key: string) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleModeChange = (nextMode: TestMode) => {
    if (nextMode === form.mode) return;
    setForm((prev) => {
      let nextDuration = prev.durationMinutes;
      if (!editingTest) {
        if (nextMode === "mini_or_part" && prev.durationMinutes === "120") {
          nextDuration = "30";
        } else if (nextMode === "full_test" && prev.durationMinutes === "30") {
          nextDuration = "120";
        }
      }

      return {
        ...prev,
        mode: nextMode,
        durationMinutes: nextDuration,
      };
    });
    setErrors({});
  };

  const handlePartCorrectChange = (part: ToeicPartKey, value: string) => {
    setForm((prev) => ({
      ...prev,
      parts: {
        ...prev.parts,
        [part]: {
          ...prev.parts[part],
          correct: value,
        },
      },
    }));
    clearError(`parts.${part}.correct`);
    clearError(`parts.${part}`);
    clearError("parts");
  };

  const handlePartTotalChange = (part: ToeicPartKey, value: string) => {
    setForm((prev) => ({
      ...prev,
      parts: {
        ...prev.parts,
        [part]: {
          ...prev.parts[part],
          total: value,
        },
      },
    }));
    clearError(`parts.${part}.total`);
    clearError(`parts.${part}.correct`);
    clearError(`parts.${part}`);
  };

  const handlePartToggle = (part: ToeicPartKey, enabled: boolean) => {
    setForm((prev) => ({
      ...prev,
      parts: {
        ...prev.parts,
        [part]: {
          ...prev.parts[part],
          enabled,
        },
      },
    }));
    clearError("parts");
    clearError(`parts.${part}`);
  };

  const livePreview = React.useMemo(() => {
    if (form.mode === "full_test") {
      const fullParts: Partial<Record<ToeicPartKey, PartScore>> = {};
      for (const key of TOEIC_PART_KEYS) {
        const maxQ = PART_MAX_QUESTIONS[key];
        const rawCorrect = parseNonNegativeInt(form.parts[key].correct);
        fullParts[key] = {
          correct: Math.min(maxQ, rawCorrect),
          total: maxQ,
        };
      }

      const summary = summarizePartScores(fullParts);
      const estimated = estimateToeicScore(
        summary.listeningCorrect,
        summary.readingCorrect
      );

      let displayListening = estimated.listeningScore;
      let displayReading = estimated.readingScore;

      if (form.isManualScoreOverride) {
        const manualL = Number(form.manualListeningScore);
        const manualR = Number(form.manualReadingScore);
        if (
          form.manualListeningScore.trim() !== "" &&
          Number.isFinite(manualL)
        ) {
          displayListening = manualL;
        }
        if (
          form.manualReadingScore.trim() !== "" &&
          Number.isFinite(manualR)
        ) {
          displayReading = manualR;
        }
      }

      return {
        listeningCorrect: summary.listeningCorrect,
        readingCorrect: summary.readingCorrect,
        estimated,
        displayListening,
        displayReading,
        displayTotal: displayListening + displayReading,
        miniCorrect: 0,
        miniTotal: 0,
        miniAccuracy: 0,
      };
    }

    let miniCorrect = 0;
    let miniTotal = 0;
    for (const key of TOEIC_PART_KEYS) {
      const entry = form.parts[key];
      if (!entry.enabled) continue;
      const total = parseNonNegativeInt(entry.total);
      const correct = Math.min(total, parseNonNegativeInt(entry.correct));
      miniCorrect += correct;
      miniTotal += total;
    }

    const miniAccuracy =
      miniTotal > 0 ? Math.round((miniCorrect / miniTotal) * 100) : 0;

    return {
      listeningCorrect: 0,
      readingCorrect: 0,
      estimated: { listeningScore: 0, readingScore: 0, totalScore: 0 },
      displayListening: 0,
      displayReading: 0,
      displayTotal: 0,
      miniCorrect,
      miniTotal,
      miniAccuracy,
    };
  }, [
    form.mode,
    form.parts,
    form.isManualScoreOverride,
    form.manualListeningScore,
    form.manualReadingScore,
  ]);

  const handleToggleManualOverride = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      isManualScoreOverride: checked,
      manualListeningScore:
        checked && prev.manualListeningScore.trim() === ""
          ? String(livePreview.estimated.listeningScore)
          : prev.manualListeningScore,
      manualReadingScore:
        checked && prev.manualReadingScore.trim() === ""
          ? String(livePreview.estimated.readingScore)
          : prev.manualReadingScore,
    }));
    clearError("manualListeningScore");
    clearError("manualReadingScore");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const candidateParts: Record<string, { correct: number | string; total: number | string }> =
      {};

    for (const key of TOEIC_PART_KEYS) {
      const entry = form.parts[key];
      if (form.mode === "full_test") {
        candidateParts[key] = {
          correct: entry.correct.trim() === "" ? 0 : entry.correct,
          total: PART_MAX_QUESTIONS[key],
        };
      } else if (entry.enabled) {
        candidateParts[key] = {
          correct: entry.correct.trim() === "" ? 0 : entry.correct,
          total: entry.total,
        };
      }
    }

    const candidate = {
      mode: form.mode,
      title: form.title,
      source: form.source,
      takenAt: form.takenAt,
      durationMinutes: form.durationMinutes,
      parts: candidateParts,
      isManualScoreOverride:
        form.mode === "full_test" ? form.isManualScoreOverride : false,
      manualListeningScore:
        form.mode === "full_test" && form.isManualScoreOverride
          ? form.manualListeningScore
          : null,
      manualReadingScore:
        form.mode === "full_test" && form.isManualScoreOverride
          ? form.manualReadingScore
          : null,
      reflectionNote: form.reflectionNote.trim() || undefined,
    };

    const parsed = testAttemptFormSchema.safeParse(candidate);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (key && !(key in nextErrors)) {
          nextErrors[key] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitTest(parsed.data);
      onOpenChange(false);
    } catch {
      // Caller handles error toast notifications.
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPartRow = (part: ToeicPartKey) => {
    const entry = form.parts[part];
    const maxQ = PART_MAX_QUESTIONS[part];
    const isFull = form.mode === "full_test";
    const isEnabled = isFull || entry.enabled;
    const correctError = errors[`parts.${part}.correct`];
    const totalError = errors[`parts.${part}.total`];

    return (
      <div
        key={part}
        className={cn(
          "rounded-md border p-2.5 transition-colors",
          isEnabled
            ? "border-border bg-card"
            : "border-border/60 bg-muted/30 opacity-75"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {!isFull ? (
              <input
                id={`toggle-${part}`}
                type="checkbox"
                checked={entry.enabled}
                onChange={(e) => handlePartToggle(part, e.target.checked)}
                aria-label={`Include ${PART_LABELS[part]}`}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
            ) : null}
            <label
              htmlFor={
                isFull ? `part-${part}-correct` : `toggle-${part}`
              }
              className="flex flex-col cursor-pointer"
            >
              <span className="text-sm font-medium text-foreground">
                {PART_LABELS[part]}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {PART_SUBTITLES[part]}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Input
              id={`part-${part}-correct`}
              type="number"
              min={0}
              max={isFull ? maxQ : 200}
              value={entry.correct}
              disabled={!isEnabled}
              onChange={(e) => handlePartCorrectChange(part, e.target.value)}
              aria-label={`${PART_LABELS[part]} correct`}
              aria-invalid={Boolean(correctError)}
              className="h-8 w-16 px-2 text-right font-mono tabular-nums"
            />
            <span className="text-xs text-muted-foreground font-mono">/</span>
            {isFull ? (
              <span className="w-10 text-left font-mono text-sm text-muted-foreground tabular-nums">
                {maxQ}
              </span>
            ) : (
              <Input
                id={`part-${part}-total`}
                type="number"
                min={1}
                max={200}
                value={entry.total}
                disabled={!isEnabled}
                onChange={(e) => handlePartTotalChange(part, e.target.value)}
                aria-label={`${PART_LABELS[part]} total`}
                aria-invalid={Boolean(totalError)}
                className="h-8 w-16 px-2 text-right font-mono tabular-nums"
              />
            )}
          </div>
        </div>

        {correctError ? (
          <p className="mt-1.5 text-xs text-danger">{correctError}</p>
        ) : totalError ? (
          <p className="mt-1.5 text-xs text-danger">{totalError}</p>
        ) : null}
      </div>
    );
  };

  const isEditing = Boolean(editingTest);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <div className="p-6 pb-4">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Test Attempt" : "Log TOEIC Test Attempt"}
            </DialogTitle>
            <DialogDescription>
              Record a 200-question simulation or targeted part drill with live
              ETS score estimation.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-5 px-6">
            {/* Mode Switcher */}
            <div
              role="tablist"
              aria-label="Test mode"
              className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted/40 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={form.mode === "full_test"}
                onClick={() => handleModeChange("full_test")}
                className={cn(
                  "rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  form.mode === "full_test"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Full Test (200 Qs)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={form.mode === "mini_or_part"}
                onClick={() => handleModeChange("mini_or_part")}
                className={cn(
                  "rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  form.mode === "mini_or_part"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Mini / Part Practice
              </button>
            </div>

            {/* Metadata Inputs */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="test-title">Test Title</Label>
                <Input
                  id="test-title"
                  placeholder="ETS 2024 - Test 01"
                  value={form.title}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, title: e.target.value }));
                    clearError("title");
                  }}
                  aria-invalid={Boolean(errors.title)}
                />
                {errors.title ? (
                  <p className="text-xs text-danger">{errors.title}</p>
                ) : null}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="test-source">Source</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SOURCE_PRESETS.map((preset) => {
                      const isActive =
                        form.source.trim().toLowerCase() ===
                        preset.toLowerCase();
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, source: preset }));
                            clearError("source");
                          }}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                            isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Input
                  id="test-source"
                  placeholder="ETS, Hacker, Study4, YBM..."
                  value={form.source}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, source: e.target.value }));
                    clearError("source");
                  }}
                  aria-invalid={Boolean(errors.source)}
                />
                {errors.source ? (
                  <p className="text-xs text-danger">{errors.source}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="test-taken-at">Date Taken</Label>
                <Input
                  id="test-taken-at"
                  type="date"
                  value={form.takenAt}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, takenAt: e.target.value }));
                    clearError("takenAt");
                  }}
                  aria-invalid={Boolean(errors.takenAt)}
                  className="font-mono tabular-nums"
                />
                {errors.takenAt ? (
                  <p className="text-xs text-danger">{errors.takenAt}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="test-duration">Duration (min)</Label>
                <Input
                  id="test-duration"
                  type="number"
                  min={1}
                  max={300}
                  value={form.durationMinutes}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      durationMinutes: e.target.value,
                    }));
                    clearError("durationMinutes");
                  }}
                  aria-invalid={Boolean(errors.durationMinutes)}
                  className="font-mono tabular-nums"
                />
                {errors.durationMinutes ? (
                  <p className="text-xs text-danger">{errors.durationMinutes}</p>
                ) : null}
              </div>
            </div>

            {/* 2-Column Part Inputs */}
            <div className="space-y-2">
              {errors.parts ? (
                <p className="text-xs text-danger">{errors.parts}</p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Listening (Parts 1–4)
                  </h3>
                  <div className="space-y-2">
                    {LISTENING_PARTS.map((part) => renderPartRow(part))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Reading (Parts 5–7)
                  </h3>
                  <div className="space-y-2">
                    {READING_PARTS.map((part) => renderPartRow(part))}
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Score Override (Full Test Only) */}
            {form.mode === "full_test" ? (
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      id="manual-score-override"
                      type="checkbox"
                      checked={form.isManualScoreOverride}
                      onChange={(e) =>
                        handleToggleManualOverride(e.target.checked)
                      }
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                    <Label
                      htmlFor="manual-score-override"
                      className="cursor-pointer"
                    >
                      Manual Score Override
                    </Label>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Use official platform L/R scores (step 5)
                  </span>
                </div>

                {form.isManualScoreOverride ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-listening-score">
                        Manual Listening Score
                      </Label>
                      <Input
                        id="manual-listening-score"
                        type="number"
                        min={5}
                        max={495}
                        step={5}
                        placeholder="e.g., 425"
                        value={form.manualListeningScore}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            manualListeningScore: e.target.value,
                          }));
                          clearError("manualListeningScore");
                        }}
                        aria-invalid={Boolean(errors.manualListeningScore)}
                        className="font-mono tabular-nums"
                      />
                      {errors.manualListeningScore ? (
                        <p className="text-xs text-danger">
                          {errors.manualListeningScore}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="manual-reading-score">
                        Manual Reading Score
                      </Label>
                      <Input
                        id="manual-reading-score"
                        type="number"
                        min={5}
                        max={495}
                        step={5}
                        placeholder="e.g., 390"
                        value={form.manualReadingScore}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            manualReadingScore: e.target.value,
                          }));
                          clearError("manualReadingScore");
                        }}
                        aria-invalid={Boolean(errors.manualReadingScore)}
                        className="font-mono tabular-nums"
                      />
                      {errors.manualReadingScore ? (
                        <p className="text-xs text-danger">
                          {errors.manualReadingScore}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Reflection Note */}
            <div className="space-y-1.5">
              <Label htmlFor="test-reflection-note">
                Reflection Note (Optional)
              </Label>
              <Textarea
                id="test-reflection-note"
                rows={2}
                placeholder="Note pacing bottlenecks, focus drops, or recurring traps..."
                value={form.reflectionNote}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    reflectionNote: e.target.value,
                  }));
                  clearError("reflectionNote");
                }}
                aria-invalid={Boolean(errors.reflectionNote)}
              />
              {errors.reflectionNote ? (
                <p className="text-xs text-danger">{errors.reflectionNote}</p>
              ) : null}
            </div>
          </div>

          {/* Sticky Live Score Preview Bar + Footer */}
          <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/85 space-y-3">
            <div
              data-testid="live-score-preview"
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3.5 py-2.5"
            >
              {form.mode === "full_test" ? (
                <>
                  <p className="font-mono text-xs sm:text-sm font-semibold text-foreground tabular-nums">
                    Listening: {livePreview.displayListening}/495 · Reading:{" "}
                    {livePreview.displayReading}/495 · Total:{" "}
                    <span className="text-primary">
                      {livePreview.displayTotal} / 990
                    </span>
                  </p>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    Raw L {livePreview.listeningCorrect}/100 · R{" "}
                    {livePreview.readingCorrect}/100
                  </span>
                </>
              ) : (
                <p className="font-mono text-xs sm:text-sm font-semibold text-foreground tabular-nums">
                  Selected Parts: {livePreview.miniCorrect} /{" "}
                  {livePreview.miniTotal} correct ({livePreview.miniAccuracy}%)
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                <span>{isEditing ? "Save Changes" : "Save Test Attempt"}</span>
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
