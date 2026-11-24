"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AudioButton } from "@/components/vocab/audio-button";
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
  ALLOWED_PARTS_OF_SPEECH,
  vocabCardFormSchema,
  type VocabCardFormValues,
  type VocabEnrichResponse,
} from "@/lib/validations/vocab";
import type { VocabCard } from "@/types/domain";

const QUICK_TOEIC_TAGS = [
  "Contracts",
  "Finance",
  "Office",
  "Marketing",
  "Travel",
  "HR",
  "Operations",
  "Part 5",
  "Part 7",
] as const;

export interface VocabFormPrefill {
  word?: string;
  contextSentence?: string;
  sourceTestId?: string;
  sourceMistakeId?: string;
  tags?: string[];
}

export interface VocabFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCard?: VocabCard | null;
  prefill?: VocabFormPrefill;
  onSubmitCard: (values: VocabCardFormValues) => Promise<void>;
}

interface FormState {
  displayWord: string;
  contextSentence: string;
  ipa: string;
  partOfSpeech: string;
  meaningEn: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  audioUrl: string;
  wordFamilyInput: string;
  collocationsInput: string;
  tagsInput: string;
  personalNote: string;
  sourceTestId: string;
  sourceMistakeId: string;
}

type FieldErrors = Partial<Record<keyof VocabCardFormValues, string>>;

function parseCommaList(raw: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      items.push(trimmed);
    }
  }

  return items;
}

function mergeTagLists(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const item of [...existing, ...incoming]) {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      merged.push(trimmed);
    }
  }

  return merged;
}

function normalizePartOfSpeech(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "adj") return "adjective";
  if (trimmed === "adv") return "adverb";
  if (trimmed === "prep") return "preposition";
  if (trimmed === "conj") return "conjunction";
  return trimmed || "noun";
}

function buildInitialState(
  editingCard?: VocabCard | null,
  prefill?: VocabFormPrefill
): FormState {
  if (editingCard) {
    return {
      displayWord: editingCard.displayWord,
      contextSentence: "",
      ipa: editingCard.ipa,
      partOfSpeech: normalizePartOfSpeech(editingCard.partOfSpeech),
      meaningEn: editingCard.meaningEn,
      meaningVi: editingCard.meaningVi,
      exampleEn: editingCard.exampleEn,
      exampleVi: editingCard.exampleVi,
      audioUrl: editingCard.audioUrl ?? "",
      wordFamilyInput: editingCard.wordFamily.join(", "),
      collocationsInput: editingCard.collocations.join(", "),
      tagsInput: editingCard.tags.join(", "),
      personalNote: editingCard.personalNote ?? "",
      sourceTestId: editingCard.sourceTestId ?? "",
      sourceMistakeId: editingCard.sourceMistakeId ?? "",
    };
  }

  return {
    displayWord: prefill?.word ?? "",
    contextSentence: prefill?.contextSentence ?? "",
    ipa: "",
    partOfSpeech: "noun",
    meaningEn: "",
    meaningVi: "",
    exampleEn: prefill?.contextSentence ?? "",
    exampleVi: "",
    audioUrl: "",
    wordFamilyInput: "",
    collocationsInput: "",
    tagsInput: prefill?.tags?.join(", ") ?? "",
    personalNote: "",
    sourceTestId: prefill?.sourceTestId ?? "",
    sourceMistakeId: prefill?.sourceMistakeId ?? "",
  };
}

export function VocabFormDialog({
  open,
  onOpenChange,
  editingCard,
  prefill,
  onSubmitCard,
}: VocabFormDialogProps) {
  const [form, setForm] = React.useState<FormState>(() =>
    buildInitialState(editingCard, prefill)
  );
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [isEnriching, setIsEnriching] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(buildInitialState(editingCard, prefill));
      setFieldErrors({});
      setIsEnriching(false);
      setIsSubmitting(false);
    }
  }, [open, editingCard, prefill]);

  const currentTags = React.useMemo(
    () => parseCommaList(form.tagsInput),
    [form.tagsInput]
  );

  const partOfSpeechOptions = React.useMemo(() => {
    const base: string[] = [...ALLOWED_PARTS_OF_SPEECH];
    if (form.partOfSpeech && !base.includes(form.partOfSpeech)) {
      base.push(form.partOfSpeech);
    }
    return base;
  }, [form.partOfSpeech]);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in fieldErrors) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleToggleQuickTag = (tag: string) => {
    const exists = currentTags.some(
      (item) => item.toLowerCase() === tag.toLowerCase()
    );
    const nextTags = exists
      ? currentTags.filter((item) => item.toLowerCase() !== tag.toLowerCase())
      : [...currentTags, tag];
    updateField("tagsInput", nextTags.join(", "));
  };

  const handleAutoFillWithAi = async () => {
    const trimmedWord = form.displayWord.trim();
    if (!trimmedWord) {
      setFieldErrors((prev) => ({
        ...prev,
        displayWord: "Enter an English word or phrase before running AI fill.",
      }));
      toast.error("Please enter an English word first.");
      return;
    }

    setIsEnriching(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Authentication session expired. Please sign in again.");
        return;
      }

      const response = await fetch("/api/ai/vocab-enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          word: trimmedWord,
          ...(form.contextSentence.trim()
            ? { contextSentence: form.contextSentence.trim() }
            : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (VocabEnrichResponse & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("meaningEn" in payload)) {
        const message =
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Failed to auto-fill vocabulary details.";
        toast.error(message);
        return;
      }

      const mergedTags = mergeTagLists(
        parseCommaList(form.tagsInput),
        payload.suggestedTags ?? []
      );

      setForm((prev) => ({
        ...prev,
        displayWord: payload.displayWord || prev.displayWord,
        ipa: payload.ipa ?? "",
        partOfSpeech: normalizePartOfSpeech(payload.partOfSpeech),
        meaningEn: payload.meaningEn,
        meaningVi: payload.meaningVi,
        exampleEn: payload.exampleEn,
        exampleVi: payload.exampleVi,
        audioUrl: payload.audioUrl ?? "",
        wordFamilyInput: (payload.wordFamily ?? []).join(", "),
        collocationsInput: (payload.collocations ?? []).join(", "),
        tagsInput: mergedTags.join(", "),
      }));
      setFieldErrors({});
      toast.success("Vocabulary details auto-filled.");
    } catch {
      toast.error("Network error while enriching vocabulary.");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const candidate = {
      displayWord: form.displayWord,
      ipa: form.ipa,
      partOfSpeech: form.partOfSpeech,
      meaningEn: form.meaningEn,
      meaningVi: form.meaningVi,
      exampleEn: form.exampleEn,
      exampleVi: form.exampleVi,
      audioUrl: form.audioUrl,
      wordFamily: parseCommaList(form.wordFamilyInput),
      collocations: parseCommaList(form.collocationsInput),
      tags: parseCommaList(form.tagsInput),
      personalNote: form.personalNote.trim() || undefined,
      sourceTestId: form.sourceTestId.trim() || undefined,
      sourceMistakeId: form.sourceMistakeId.trim() || undefined,
    };

    const parsed = vocabCardFormSchema.safeParse(candidate);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      const flattened = parsed.error.flatten().fieldErrors;
      for (const [key, messages] of Object.entries(flattened)) {
        if (messages && messages.length > 0) {
          nextErrors[key as keyof VocabCardFormValues] = messages[0];
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitCard(parsed.data);
      onOpenChange(false);
    } catch {
      // Caller handles error toast notifications.
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(editingCard);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Vocabulary Card" : "Add Vocabulary Card"}
          </DialogTitle>
          <DialogDescription>
            Store a TOEIC word with bilingual meanings, IPA, and workplace
            collocations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="vocab-display-word">English Word or Phrase</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="vocab-display-word"
                    placeholder="e.g., negotiate, reimburse, comply with"
                    value={form.displayWord}
                    onChange={(e) => updateField("displayWord", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.displayWord)}
                  />
                  <AudioButton
                    text={form.displayWord}
                    audioUrl={form.audioUrl || null}
                  />
                </div>
                {fieldErrors.displayWord ? (
                  <p className="text-xs text-danger">
                    {fieldErrors.displayWord}
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={handleAutoFillWithAi}
                disabled={isEnriching || isSubmitting}
                className="shrink-0"
              >
                {isEnriching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                <span>{isEnriching ? "Enriching..." : "Auto-fill with AI"}</span>
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vocab-context-sentence">
                Context Sentence (Optional for AI)
              </Label>
              <Input
                id="vocab-context-sentence"
                placeholder="Paste a TOEIC question or email sentence for tailored meaning..."
                value={form.contextSentence}
                onChange={(e) => updateField("contextSentence", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vocab-ipa">IPA Pronunciation</Label>
              <Input
                id="vocab-ipa"
                placeholder="/nɪˈɡoʊ.ʃi.eɪt/"
                className="font-mono"
                value={form.ipa}
                onChange={(e) => updateField("ipa", e.target.value)}
                aria-invalid={Boolean(fieldErrors.ipa)}
              />
              {fieldErrors.ipa ? (
                <p className="text-xs text-danger">{fieldErrors.ipa}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vocab-pos">Part of Speech</Label>
              <select
                id="vocab-pos"
                value={form.partOfSpeech}
                onChange={(e) => updateField("partOfSpeech", e.target.value)}
                aria-invalid={Boolean(fieldErrors.partOfSpeech)}
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {partOfSpeechOptions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
              {fieldErrors.partOfSpeech ? (
                <p className="text-xs text-danger">
                  {fieldErrors.partOfSpeech}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vocab-meaning-en">English Definition</Label>
              <Textarea
                id="vocab-meaning-en"
                rows={2}
                placeholder="Clear definition in a TOEIC business context"
                value={form.meaningEn}
                onChange={(e) => updateField("meaningEn", e.target.value)}
                aria-invalid={Boolean(fieldErrors.meaningEn)}
              />
              {fieldErrors.meaningEn ? (
                <p className="text-xs text-danger">{fieldErrors.meaningEn}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vocab-meaning-vi">Vietnamese Meaning</Label>
              <Textarea
                id="vocab-meaning-vi"
                rows={2}
                placeholder="Accurate Vietnamese meaning"
                value={form.meaningVi}
                onChange={(e) => updateField("meaningVi", e.target.value)}
                aria-invalid={Boolean(fieldErrors.meaningVi)}
              />
              {fieldErrors.meaningVi ? (
                <p className="text-xs text-danger">{fieldErrors.meaningVi}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vocab-example-en">English Example</Label>
              <Textarea
                id="vocab-example-en"
                rows={2}
                placeholder="Realistic TOEIC business example sentence"
                value={form.exampleEn}
                onChange={(e) => updateField("exampleEn", e.target.value)}
                aria-invalid={Boolean(fieldErrors.exampleEn)}
              />
              {fieldErrors.exampleEn ? (
                <p className="text-xs text-danger">{fieldErrors.exampleEn}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vocab-example-vi">Vietnamese Translation</Label>
              <Textarea
                id="vocab-example-vi"
                rows={2}
                placeholder="Vietnamese translation of the example sentence"
                value={form.exampleVi}
                onChange={(e) => updateField("exampleVi", e.target.value)}
                aria-invalid={Boolean(fieldErrors.exampleVi)}
              />
              {fieldErrors.exampleVi ? (
                <p className="text-xs text-danger">{fieldErrors.exampleVi}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vocab-word-family">
                Word Family (comma-separated)
              </Label>
              <Input
                id="vocab-word-family"
                placeholder="negotiation, negotiable, negotiator"
                value={form.wordFamilyInput}
                onChange={(e) => updateField("wordFamilyInput", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vocab-collocations">
                Collocations (comma-separated)
              </Label>
              <Input
                id="vocab-collocations"
                placeholder="negotiate a contract, negotiate terms"
                value={form.collocationsInput}
                onChange={(e) =>
                  updateField("collocationsInput", e.target.value)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vocab-tags">TOEIC Topic Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TOEIC_TAGS.map((tag) => {
                const isSelected = currentTags.some(
                  (item) => item.toLowerCase() === tag.toLowerCase()
                );
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleQuickTag(tag)}
                    aria-pressed={isSelected}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <Input
              id="vocab-tags"
              placeholder="Contracts, Finance, Part 5"
              value={form.tagsInput}
              onChange={(e) => updateField("tagsInput", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vocab-audio-url">Audio URL (Optional)</Label>
              <Input
                id="vocab-audio-url"
                placeholder="https://..."
                value={form.audioUrl}
                onChange={(e) => updateField("audioUrl", e.target.value)}
                aria-invalid={Boolean(fieldErrors.audioUrl)}
              />
              {fieldErrors.audioUrl ? (
                <p className="text-xs text-danger">{fieldErrors.audioUrl}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vocab-personal-note">
                Personal Note (Optional)
              </Label>
              <Input
                id="vocab-personal-note"
                placeholder="Grammar trap, suffix hint, or mnemonic..."
                value={form.personalNote}
                onChange={(e) => updateField("personalNote", e.target.value)}
                aria-invalid={Boolean(fieldErrors.personalNote)}
              />
              {fieldErrors.personalNote ? (
                <p className="text-xs text-danger">
                  {fieldErrors.personalNote}
                </p>
              ) : null}
            </div>
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
            <Button type="submit" disabled={isSubmitting || isEnriching}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              <span>{isEditing ? "Save Changes" : "Add Word"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
