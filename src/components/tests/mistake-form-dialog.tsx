"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
import { getIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";
import {
  ERROR_CATEGORIES,
  ERROR_CATEGORY_LABELS,
  mistakeFormSchema,
  type MistakeExplainResponse,
  type MistakeFormValues,
} from "@/lib/validations/mistake";
import type { ErrorCategory, MistakeRecord } from "@/types/domain";

const TOEIC_PARTS = [1, 2, 3, 4, 5, 6, 7] as const;

export interface MistakeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingMistake?: MistakeRecord | null;
  defaultPart?: number;
  onSubmitMistake: (values: MistakeFormValues) => Promise<void>;
}

interface FormState {
  part: number;
  questionNumber: string;
  errorCategory: ErrorCategory;
  promptSnippet: string;
  userAnswer: string;
  correctAnswer: string;
  extractedWord: string;
  explanation: string;
}

type FieldErrors = Partial<Record<keyof MistakeFormValues, string>>;

function buildInitialState(
  editingMistake?: MistakeRecord | null,
  defaultPart: number = 5
): FormState {
  if (editingMistake) {
    return {
      part: editingMistake.part,
      questionNumber:
        editingMistake.questionNumber !== undefined
          ? String(editingMistake.questionNumber)
          : "",
      errorCategory: editingMistake.errorCategory,
      promptSnippet: editingMistake.promptSnippet,
      userAnswer: editingMistake.userAnswer ?? "",
      correctAnswer: editingMistake.correctAnswer ?? "",
      extractedWord: editingMistake.extractedWord ?? "",
      explanation: editingMistake.explanation ?? "",
    };
  }

  return {
    part:
      defaultPart >= 1 && defaultPart <= 7 ? Math.trunc(defaultPart) : 5,
    questionNumber: "",
    errorCategory: "vocab",
    promptSnippet: "",
    userAnswer: "",
    correctAnswer: "",
    extractedWord: "",
    explanation: "",
  };
}

export function MistakeFormDialog({
  open,
  onOpenChange,
  editingMistake,
  defaultPart = 5,
  onSubmitMistake,
}: MistakeFormDialogProps) {
  const [form, setForm] = React.useState<FormState>(() =>
    buildInitialState(editingMistake, defaultPart)
  );
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [aiResult, setAiResult] = React.useState<MistakeExplainResponse | null>(
    null
  );
  const [isExplaining, setIsExplaining] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(buildInitialState(editingMistake, defaultPart));
      setFieldErrors({});
      setAiResult(null);
      setIsExplaining(false);
      setIsSubmitting(false);
    }
  }, [open, editingMistake, defaultPart]);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in fieldErrors) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleExplainWithAi = async () => {
    const trimmedSnippet = form.promptSnippet.trim();
    if (!trimmedSnippet) {
      setFieldErrors((prev) => ({
        ...prev,
        promptSnippet:
          "Enter a question or trap summary before requesting an AI explanation.",
      }));
      toast.error("Please enter the question or trap summary first.");
      return;
    }

    setIsExplaining(true);
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
          part: form.part,
          promptSnippet: trimmedSnippet,
          ...(form.userAnswer.trim()
            ? { userAnswer: form.userAnswer.trim() }
            : {}),
          ...(form.correctAnswer.trim()
            ? { correctAnswer: form.correctAnswer.trim() }
            : {}),
          errorCategory: form.errorCategory,
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

      const combinedExplanation = payload.toeicTip
        ? `${payload.explanation}\n\nTOEIC Tip: ${payload.toeicTip}`
        : payload.explanation;

      setAiResult(payload);
      setForm((prev) => ({
        ...prev,
        explanation: combinedExplanation,
        extractedWord:
          prev.extractedWord.trim() === "" && payload.keyVocabulary.length > 0
            ? payload.keyVocabulary[0]
            : prev.extractedWord,
      }));
      toast.success("AI explanation generated.");
    } catch {
      toast.error("Network error while requesting AI explanation.");
    } finally {
      setIsExplaining(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const candidate = {
      part: form.part,
      questionNumber: form.questionNumber,
      errorCategory: form.errorCategory,
      promptSnippet: form.promptSnippet,
      userAnswer: form.userAnswer,
      correctAnswer: form.correctAnswer,
      explanation: form.explanation,
      extractedWord: form.extractedWord,
    };

    const parsed = mistakeFormSchema.safeParse(candidate);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      const flattened = parsed.error.flatten().fieldErrors;
      for (const [key, messages] of Object.entries(flattened)) {
        if (messages && messages.length > 0) {
          nextErrors[key as keyof MistakeFormValues] = messages[0];
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitMistake(parsed.data);
      onOpenChange(false);
    } catch {
      // Caller handles error toast notifications.
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(editingMistake);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Mistake Record" : "Log Test Mistake"}
          </DialogTitle>
          <DialogDescription>
            Capture the missed question, categorize the trap, and extract key
            vocabulary for spaced repetition.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Part & Question Number */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>TOEIC Part</Label>
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Select TOEIC Part"
              >
                {TOEIC_PARTS.map((partNum) => {
                  const isSelected = form.part === partNum;
                  return (
                    <button
                      key={partNum}
                      type="button"
                      onClick={() => updateField("part", partNum)}
                      aria-pressed={isSelected}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-accent"
                      )}
                    >
                      Part {partNum}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.part ? (
                <p className="text-xs text-danger">{fieldErrors.part}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mistake-question-number">
                Question # (Optional)
              </Label>
              <Input
                id="mistake-question-number"
                type="number"
                min={1}
                max={200}
                placeholder="1–200"
                value={form.questionNumber}
                onChange={(e) => updateField("questionNumber", e.target.value)}
                aria-invalid={Boolean(fieldErrors.questionNumber)}
                className="font-mono tabular-nums"
              />
              {fieldErrors.questionNumber ? (
                <p className="text-xs text-danger">
                  {fieldErrors.questionNumber}
                </p>
              ) : null}
            </div>
          </div>

          {/* Error Category Pills */}
          <div className="space-y-1.5">
            <Label>Error Category</Label>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Select error category"
            >
              {ERROR_CATEGORIES.map((category) => {
                const isSelected = form.errorCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => updateField("errorCategory", category)}
                    aria-pressed={isSelected}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {ERROR_CATEGORY_LABELS[category]}
                  </button>
                );
              })}
            </div>
            {fieldErrors.errorCategory ? (
              <p className="text-xs text-danger">{fieldErrors.errorCategory}</p>
            ) : null}
          </div>

          {/* Prompt Snippet */}
          <div className="space-y-1.5">
            <Label htmlFor="mistake-prompt-snippet">
              Question / Trap Summary
            </Label>
            <Textarea
              id="mistake-prompt-snippet"
              rows={3}
              placeholder="e.g., The revised agreement must be returned _____ Friday afternoon."
              value={form.promptSnippet}
              onChange={(e) => updateField("promptSnippet", e.target.value)}
              aria-invalid={Boolean(fieldErrors.promptSnippet)}
            />
            {fieldErrors.promptSnippet ? (
              <p className="text-xs text-danger">{fieldErrors.promptSnippet}</p>
            ) : null}
          </div>

          {/* Answers & Extracted Word */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="mistake-user-answer">
                Your Answer (Optional)
              </Label>
              <Input
                id="mistake-user-answer"
                placeholder="e.g., (A) until"
                value={form.userAnswer}
                onChange={(e) => updateField("userAnswer", e.target.value)}
                aria-invalid={Boolean(fieldErrors.userAnswer)}
              />
              {fieldErrors.userAnswer ? (
                <p className="text-xs text-danger">{fieldErrors.userAnswer}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mistake-correct-answer">
                Correct Answer (Optional)
              </Label>
              <Input
                id="mistake-correct-answer"
                placeholder="e.g., (C) by"
                value={form.correctAnswer}
                onChange={(e) => updateField("correctAnswer", e.target.value)}
                aria-invalid={Boolean(fieldErrors.correctAnswer)}
              />
              {fieldErrors.correctAnswer ? (
                <p className="text-xs text-danger">
                  {fieldErrors.correctAnswer}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mistake-extracted-word">
                Key Word (Optional)
              </Label>
              <Input
                id="mistake-extracted-word"
                placeholder="e.g., reimburse"
                value={form.extractedWord}
                onChange={(e) => updateField("extractedWord", e.target.value)}
                aria-invalid={Boolean(fieldErrors.extractedWord)}
              />
              {fieldErrors.extractedWord ? (
                <p className="text-xs text-danger">
                  {fieldErrors.extractedWord}
                </p>
              ) : null}
            </div>
          </div>

          {/* Explanation + Explain with AI */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="mistake-explanation">
                Explanation &amp; Takeaway (Optional)
              </Label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleExplainWithAi()}
                disabled={isExplaining || isSubmitting}
              >
                {isExplaining ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                )}
                <span>{isExplaining ? "Explaining..." : "Explain with AI"}</span>
              </Button>
            </div>

            <Textarea
              id="mistake-explanation"
              rows={3}
              placeholder="Explain why the trap occurred or let AI analyze the question..."
              value={form.explanation}
              onChange={(e) => updateField("explanation", e.target.value)}
              aria-invalid={Boolean(fieldErrors.explanation)}
            />
            {fieldErrors.explanation ? (
              <p className="text-xs text-danger">{fieldErrors.explanation}</p>
            ) : null}

            {aiResult && aiResult.keyVocabulary.length > 0 ? (
              <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  AI Key Vocabulary (click to set Key Word):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {aiResult.keyVocabulary.map((word) => {
                    const isPicked =
                      form.extractedWord.trim().toLowerCase() ===
                      word.toLowerCase();
                    return (
                      <button
                        key={word}
                        type="button"
                        onClick={() => updateField("extractedWord", word)}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                          isPicked
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:bg-accent"
                        )}
                      >
                        {word}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isExplaining}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              <span>{isEditing ? "Save Changes" : "Log Mistake"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
