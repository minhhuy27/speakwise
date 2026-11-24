"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AudioButton } from "@/components/vocab/audio-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { isLeechCard, previewGradeIntervals } from "@/lib/engines/srs";
import { playWordAudio } from "@/lib/speech";
import { cn } from "@/lib/utils";
import type { SrsGrade, VocabCard } from "@/types/domain";

export interface FlashcardReviewProps {
  initialQueue: VocabCard[];
  onGradeCard: (card: VocabCard, grade: SrsGrade) => Promise<unknown>;
  onExit: () => void;
}

interface GradeOption {
  grade: SrsGrade;
  shortcut: "1" | "2" | "3" | "4";
  label: string;
  accentClass: string;
}

const GRADE_OPTIONS: readonly GradeOption[] = [
  {
    grade: 0,
    shortcut: "1",
    label: "Again",
    accentClass:
      "border-danger/40 text-danger hover:bg-danger/10 hover:border-danger",
  },
  {
    grade: 1,
    shortcut: "2",
    label: "Hard",
    accentClass:
      "border-warning/40 text-warning hover:bg-warning/10 hover:border-warning",
  },
  {
    grade: 2,
    shortcut: "3",
    label: "Good",
    accentClass:
      "border-info/40 text-info hover:bg-info/10 hover:border-info",
  },
  {
    grade: 3,
    shortcut: "4",
    label: "Easy",
    accentClass:
      "border-success/40 text-success hover:bg-success/10 hover:border-success",
  },
];

function formatIntervalDays(days: number): string {
  return `${days}d`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function FlashcardReview({
  initialQueue,
  onGradeCard,
  onExit,
}: FlashcardReviewProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [showContextHint, setShowContextHint] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [gradeCounts, setGradeCounts] = React.useState<Record<SrsGrade, number>>({
    0: 0,
    1: 0,
    2: 0,
    3: 0,
  });

  const totalCards = initialQueue.length;
  const isComplete = currentIndex >= totalCards;
  const currentCard = isComplete ? null : initialQueue[currentIndex];

  const predictedIntervals = React.useMemo(
    () => (currentCard ? previewGradeIntervals(currentCard) : null),
    [currentCard]
  );

  const handleFlip = React.useCallback(() => {
    setIsFlipped(true);
  }, []);

  const handleGrade = React.useCallback(
    async (grade: SrsGrade) => {
      if (!currentCard || !isFlipped || isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onGradeCard(currentCard, grade);
        setGradeCounts((prev) => ({
          ...prev,
          [grade]: prev[grade] + 1,
        }));
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
        setShowContextHint(false);
      } catch {
        toast.error("Failed to save review progress. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentCard, isFlipped, isSubmitting, onGradeCard]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (!currentCard) {
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        if (!isFlipped) {
          event.preventDefault();
          handleFlip();
        }
        return;
      }

      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        void playWordAudio(currentCard.displayWord, currentCard.audioUrl);
        return;
      }

      if (!isFlipped || isSubmitting) {
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        void handleGrade(0);
      } else if (event.key === "2") {
        event.preventDefault();
        void handleGrade(1);
      } else if (event.key === "3") {
        event.preventDefault();
        void handleGrade(2);
      } else if (event.key === "4") {
        event.preventDefault();
        void handleGrade(3);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentCard, isFlipped, isSubmitting, handleFlip, handleGrade]);

  const progressPercent =
    totalCards === 0
      ? 100
      : Math.min(100, Math.round(((isComplete ? totalCards : currentIndex + 1) / totalCards) * 100));

  const totalReviewed =
    gradeCounts[0] + gradeCounts[1] + gradeCounts[2] + gradeCounts[3];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onExit}
            aria-label="Exit review session"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Exit</span>
          </Button>

          <div className="flex flex-1 items-center gap-3 max-w-xs sm:max-w-sm">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalCards}
              aria-valuenow={isComplete ? totalCards : currentIndex + 1}
              aria-label="Review session progress"
            >
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-xs font-medium text-muted-foreground tabular-nums">
              {isComplete
                ? `${totalCards} / ${totalCards}`
                : `${currentIndex + 1} / ${totalCards}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                Space
              </kbd>
              <span>Flip</span>
              <span>·</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                S
              </kbd>
              <span>Audio</span>
              <span>·</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                1–4
              </kbd>
              <span>Grade</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-6 sm:py-10">
        {isComplete || !currentCard ? (
          <Card className="mx-auto w-full max-w-xl border-border">
            <CardContent className="p-6 sm:p-8 text-center space-y-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Session Complete
                </h1>
                <p className="text-sm text-muted-foreground">
                  You reviewed{" "}
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {totalReviewed}
                  </span>{" "}
                  {totalReviewed === 1 ? "word" : "words"} in this session.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {GRADE_OPTIONS.map((option) => (
                  <div
                    key={option.grade}
                    className="rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {option.label}
                    </p>
                    <p className="mt-1 font-mono text-xl font-bold text-foreground tabular-nums">
                      {gradeCounts[option.grade]}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                <Button asChild>
                  <Link href="/vocab">Back to Vocabulary</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/">Go to Overview</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-border shadow-sm">
              <CardContent className="p-6 sm:p-8 space-y-6">
                {/* Front Side */}
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Badge variant="secondary">{currentCard.partOfSpeech}</Badge>
                    {isLeechCard(currentCard) ? (
                      <Badge variant="danger">Leech</Badge>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                      {currentCard.displayWord}
                    </h1>
                    <AudioButton
                      text={currentCard.displayWord}
                      audioUrl={currentCard.audioUrl}
                    />
                  </div>

                  {!isFlipped && currentCard.exampleEn ? (
                    <div className="space-y-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowContextHint((prev) => !prev)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {showContextHint ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {showContextHint
                            ? "Hide context hint"
                            : "Show context hint"}
                        </span>
                      </Button>

                      {showContextHint ? (
                        <p className="max-w-xl rounded-md border border-border bg-muted/40 px-4 py-2.5 text-sm italic text-muted-foreground">
                          {currentCard.exampleEn}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {!isFlipped ? (
                    <div className="pt-4">
                      <Button
                        type="button"
                        size="lg"
                        onClick={handleFlip}
                        className="min-w-[180px]"
                      >
                        <span>Show Answer</span>
                        <kbd className="ml-1 hidden sm:inline-block rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[11px]">
                          Space
                        </kbd>
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Back Side */}
                {isFlipped ? (
                  <div className="space-y-5 transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-1">
                    <Separator />

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            English Definition
                          </span>
                          {currentCard.ipa ? (
                            <span className="font-mono text-sm text-muted-foreground">
                              {currentCard.ipa}
                            </span>
                          ) : null}
                        </div>
                        <AudioButton
                          text={currentCard.displayWord}
                          audioUrl={currentCard.audioUrl}
                          size="sm"
                          variant="ghost"
                        />
                      </div>

                      <p className="text-base sm:text-lg font-medium leading-relaxed text-foreground">
                        {currentCard.meaningEn}
                      </p>

                      <div className="rounded-md border border-border bg-muted/40 px-3.5 py-2.5">
                        <p className="text-sm font-medium text-muted-foreground">
                          {currentCard.meaningVi}
                        </p>
                      </div>
                    </div>

                    {currentCard.exampleEn || currentCard.exampleVi ? (
                      <div className="space-y-1.5 rounded-md border border-border/80 bg-background/60 p-3.5">
                        {currentCard.exampleEn ? (
                          <p className="text-sm text-foreground">
                            {currentCard.exampleEn}
                          </p>
                        ) : null}
                        {currentCard.exampleVi ? (
                          <p className="text-xs text-muted-foreground">
                            {currentCard.exampleVi}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {currentCard.wordFamily.length > 0 ||
                    currentCard.collocations.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        {currentCard.wordFamily.length > 0 ? (
                          <div className="space-y-1">
                            <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                              Word Family
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {currentCard.wordFamily.map((item) => (
                                <Badge key={item} variant="outline">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {currentCard.collocations.length > 0 ? (
                          <div className="space-y-1">
                            <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                              Collocations
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {currentCard.collocations.map((item) => (
                                <Badge key={item} variant="secondary">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {currentCard.personalNote ? (
                      <div className="rounded-md border border-warning/30 bg-warning/5 px-3.5 py-2 text-xs text-foreground">
                        <span className="font-semibold">Note: </span>
                        {currentCard.personalNote}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {isFlipped && predictedIntervals ? (
              <div
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
                role="group"
                aria-label="SM-2 review grades"
              >
                {GRADE_OPTIONS.map((option) => (
                  <Button
                    key={option.grade}
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => void handleGrade(option.grade)}
                    className={cn(
                      "min-h-[48px] h-auto flex-col items-center justify-center gap-0.5 py-2.5",
                      option.accentClass
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <kbd className="rounded border border-current/25 px-1 py-0.2 font-mono text-[11px]">
                        {option.shortcut}
                      </kbd>
                      <span>{option.label}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {option.grade === 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" />
                          {formatIntervalDays(predictedIntervals[option.grade])}
                        </span>
                      ) : (
                        formatIntervalDays(predictedIntervals[option.grade])
                      )}
                    </span>
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
