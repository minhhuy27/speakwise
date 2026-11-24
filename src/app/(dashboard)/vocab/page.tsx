"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
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
import { AudioButton } from "@/components/vocab/audio-button";
import {
  VocabFormDialog,
  type VocabFormPrefill,
} from "@/components/vocab/vocab-form-dialog";
import { buildDailyStudyQueue, isLeechCard } from "@/lib/engines/srs";
import {
  createVocabCard,
  deleteVocabCard,
  subscribeUserVocab,
  updateVocabCard,
} from "@/lib/firebase/repositories/vocab";
import { cn } from "@/lib/utils";
import type { VocabCardFormValues } from "@/lib/validations/vocab";
import type { VocabCard, VocabStatus } from "@/types/domain";

type StatusFilter = "all" | "due" | "new" | "learning" | "mastered" | "leech";

const STATUS_TABS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "mastered", label: "Mastered" },
  { value: "leech", label: "Leech" },
];

function getStatusBadgeConfig(status: VocabStatus): {
  label: string;
  variant: "secondary" | "warning" | "info" | "success";
} {
  switch (status) {
    case "new":
      return { label: "New", variant: "secondary" };
    case "learning":
      return { label: "Learning", variant: "warning" };
    case "review":
      return { label: "Review", variant: "info" };
    case "mastered":
      return { label: "Mastered", variant: "success" };
  }
}

function VocabPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    </div>
  );
}

function VocabBankContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  const [cards, setCards] = React.useState<VocabCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCard, setEditingCard] = React.useState<VocabCard | null>(null);
  const [prefill, setPrefill] = React.useState<VocabFormPrefill | undefined>(
    undefined
  );
  const [deletingCard, setDeletingCard] = React.useState<VocabCard | null>(
    null
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handledParamSignatureRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubscribe = subscribeUserVocab(
      user.uid,
      (nextCards) => {
        setCards(nextCards);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to subscribe to vocabulary bank:", error);
        toast.error("Failed to sync vocabulary bank.");
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  React.useEffect(() => {
    const shouldAdd = searchParams.get("add") === "1";
    if (!shouldAdd) return;

    const signature = searchParams.toString();
    if (handledParamSignatureRef.current === signature) return;
    handledParamSignatureRef.current = signature;

    const wordParam = searchParams.get("word") ?? undefined;
    const contextParam = searchParams.get("context") ?? undefined;
    const sourceTestIdParam = searchParams.get("sourceTestId") ?? undefined;
    const sourceMistakeIdParam =
      searchParams.get("sourceMistakeId") ?? undefined;

    setEditingCard(null);
    setPrefill({
      word: wordParam,
      contextSentence: contextParam,
      sourceTestId: sourceTestIdParam,
      sourceMistakeId: sourceMistakeIdParam,
    });
    setDialogOpen(true);
  }, [searchParams]);

  const dailyLimit = profile?.dailyNewWordsLimit ?? 15;

  const studyQueueCount = React.useMemo(
    () => buildDailyStudyQueue(cards, dailyLimit).queue.length,
    [cards, dailyLimit]
  );

  const metrics = React.useMemo(() => {
    const masteredCount = cards.filter(
      (card) => card.status === "mastered"
    ).length;
    const leechCount = cards.filter((card) => isLeechCard(card)).length;

    return {
      total: cards.length,
      dueToday: studyQueueCount,
      mastered: masteredCount,
      leeches: leechCount,
    };
  }, [cards, studyQueueCount]);

  const availableTags = React.useMemo(() => {
    const tagMap = new Map<string, string>();
    for (const card of cards) {
      for (const tag of card.tags) {
        const trimmed = tag.trim();
        const key = trimmed.toLowerCase();
        if (trimmed && !tagMap.has(key)) {
          tagMap.set(key, trimmed);
        }
      }
    }
    return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));
  }, [cards]);

  const filteredCards = React.useMemo(() => {
    const nowMs = Date.now();
    const query = searchQuery.trim().toLowerCase();

    return cards.filter((card) => {
      if (statusFilter === "due") {
        const isDue =
          card.status !== "new" &&
          new Date(card.nextReviewAt).getTime() <= nowMs;
        if (!isDue) return false;
      } else if (statusFilter === "new") {
        if (card.status !== "new") return false;
      } else if (statusFilter === "learning") {
        if (card.status !== "learning" && card.status !== "review") {
          return false;
        }
      } else if (statusFilter === "mastered") {
        if (card.status !== "mastered") return false;
      } else if (statusFilter === "leech") {
        if (!isLeechCard(card)) return false;
      }

      if (selectedTag) {
        const hasTag = card.tags.some(
          (tag) => tag.trim().toLowerCase() === selectedTag.toLowerCase()
        );
        if (!hasTag) return false;
      }

      if (query) {
        const matchesDisplay = card.displayWord.toLowerCase().includes(query);
        const matchesMeaningEn = card.meaningEn.toLowerCase().includes(query);
        const matchesMeaningVi = card.meaningVi.toLowerCase().includes(query);
        const matchesCollocations = card.collocations.some((col) =>
          col.toLowerCase().includes(query)
        );
        if (
          !matchesDisplay &&
          !matchesMeaningEn &&
          !matchesMeaningVi &&
          !matchesCollocations
        ) {
          return false;
        }
      }

      return true;
    });
  }, [cards, searchQuery, statusFilter, selectedTag]);

  const handleOpenAddDialog = () => {
    setEditingCard(null);
    setPrefill(undefined);
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (card: VocabCard) => {
    setPrefill(undefined);
    setEditingCard(card);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && searchParams.get("add") === "1") {
      router.replace("/vocab");
    }
  };

  const handleSubmitCard = async (values: VocabCardFormValues) => {
    if (!user) return;

    try {
      if (editingCard) {
        await updateVocabCard(user.uid, editingCard.id, values);
        toast.success(`Updated "${values.displayWord.trim()}".`);
      } else {
        await createVocabCard(user.uid, values);
        toast.success(`Added "${values.displayWord.trim()}" to your bank.`);
      }
    } catch (error) {
      console.error("Failed to save vocabulary card:", error);
      toast.error("Failed to save vocabulary card. Please try again.");
      throw error;
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingCard) return;

    setIsDeleting(true);
    try {
      await deleteVocabCard(user.uid, deletingCard.id);
      toast.success(`Deleted "${deletingCard.displayWord}".`);
      setDeletingCard(null);
    } catch (error) {
      console.error("Failed to delete vocabulary card:", error);
      toast.error("Failed to delete vocabulary card.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedTag(null);
  };

  if (loading) {
    return <VocabPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Vocabulary Bank
          </h1>
          <p className="text-sm text-muted-foreground">
            Bilingual TOEIC business deck powered by SM-2 spaced repetition.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {studyQueueCount > 0 ? (
            <Button asChild>
              <Link href="/vocab/review">
                <Play className="h-4 w-4" />
                <span className="tabular-nums">
                  Review Now ({studyQueueCount}{" "}
                  {studyQueueCount === 1 ? "card" : "cards"})
                </span>
              </Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>All caught up</span>
            </Button>
          )}

          <Button
            type="button"
            variant={studyQueueCount > 0 ? "outline" : "default"}
            onClick={handleOpenAddDialog}
          >
            <Plus className="h-4 w-4" />
            <span>Add Word</span>
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total Words
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {metrics.total}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Due Today
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-primary tabular-nums">
              {metrics.dueToday}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Mastered
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-success tabular-nums">
              {metrics.mastered}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Leech Words
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-bold tracking-tight tabular-nums",
                metrics.leeches > 0 ? "text-danger" : "text-foreground"
              )}
            >
              {metrics.leeches}
            </p>
          </CardContent>
        </Card>
      </div>

      {cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">
                Your vocabulary bank is empty — Add your first TOEIC word
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Build your bilingual deck with AI-assisted definitions, IPA,
                audio playback, and spaced repetition scheduling.
              </p>
            </div>
            <Button type="button" onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4" />
              <span>Add First Word</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search & Filters */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search word, meaning, or collocation..."
                  aria-label="Search vocabulary bank"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div
                className="flex flex-wrap gap-1.5"
                role="tablist"
                aria-label="Filter vocabulary by status"
              >
                {STATUS_TABS.map((tab) => {
                  const isActive = statusFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setStatusFilter(tab.value)}
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

            {availableTags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground mr-1">
                  Tags:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  aria-pressed={selectedTag === null}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    selectedTag === null
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Tags
                </button>
                {availableTags.map((tag) => {
                  const isSelected =
                    selectedTag?.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(isSelected ? null : tag)}
                      aria-pressed={isSelected}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Vocabulary Cards */}
          {filteredCards.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">
                  No vocabulary cards match your current search or filters.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredCards.map((card) => {
                const statusBadge = getStatusBadgeConfig(card.status);
                const leech = isLeechCard(card);

                return (
                  <Card
                    key={card.id}
                    className="transition-colors hover:border-primary/30"
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold tracking-tight text-foreground">
                              {card.displayWord}
                            </h2>
                            {card.ipa ? (
                              <span className="font-mono text-sm text-muted-foreground">
                                {card.ipa}
                              </span>
                            ) : null}
                            <AudioButton
                              text={card.displayWord}
                              audioUrl={card.audioUrl}
                              size="sm"
                              variant="ghost"
                            />
                            <Badge variant="outline">{card.partOfSpeech}</Badge>
                            <Badge variant={statusBadge.variant}>
                              {statusBadge.label}
                            </Badge>
                            {leech ? (
                              <Badge variant="danger" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Leech
                              </Badge>
                            ) : null}
                          </div>

                          {/* Bilingual Meaning Pair: English primary above Vietnamese */}
                          <div className="space-y-0.5 pt-0.5">
                            <p className="text-sm font-medium text-foreground">
                              {card.meaningEn}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {card.meaningVi}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDialog(card)}
                            aria-label={`Edit ${card.displayWord}`}
                          >
                            <Pencil className="h-4 w-4" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingCard(card)}
                            aria-label={`Delete ${card.displayWord}`}
                            className="text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                          </Button>
                        </div>
                      </div>

                      {card.exampleEn || card.exampleVi ? (
                        <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 space-y-0.5">
                          {card.exampleEn ? (
                            <p className="text-xs text-foreground">
                              {card.exampleEn}
                            </p>
                          ) : null}
                          {card.exampleVi ? (
                            <p className="text-xs text-muted-foreground">
                              {card.exampleVi}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {card.tags.length > 0 || card.collocations.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {card.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                          {card.collocations.map((collocation) => (
                            <Badge
                              key={collocation}
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              {collocation}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <VocabFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editingCard={editingCard}
        prefill={prefill}
        onSubmitCard={handleSubmitCard}
      />

      <Dialog
        open={Boolean(deletingCard)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeletingCard(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Vocabulary Card</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deletingCard?.displayWord}
              </span>
              ? This removes its SM-2 review history permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingCard(null)}
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
              {isDeleting ? "Deleting..." : "Delete Word"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VocabPage() {
  return (
    <React.Suspense fallback={<VocabPageSkeleton />}>
      <VocabBankContent />
    </React.Suspense>
  );
}
