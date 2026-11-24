"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FlashcardReview } from "@/components/vocab/flashcard-review";
import { buildDailyStudyQueue } from "@/lib/engines/srs";
import {
  listUserVocab,
  recordVocabReview,
} from "@/lib/firebase/repositories/vocab";
import type { SrsGrade, VocabCard } from "@/types/domain";

export default function VocabReviewPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [sessionQueue, setSessionQueue] = React.useState<VocabCard[] | null>(
    null
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const initializedForUidRef = React.useRef<string | null>(null);

  const dailyLimit = profile?.dailyNewWordsLimit ?? 15;

  React.useEffect(() => {
    if (!user) return;
    if (initializedForUidRef.current === user.uid) return;
    initializedForUidRef.current = user.uid;

    let active = true;

    async function loadQueue() {
      try {
        const cards = await listUserVocab(user!.uid);
        if (!active) return;
        const { queue } = buildDailyStudyQueue(cards, dailyLimit);
        setSessionQueue(queue);
      } catch (error) {
        console.error("Failed to load study queue:", error);
        if (active) {
          setLoadError("Unable to load your review queue right now.");
          toast.error("Failed to load vocabulary review queue.");
        }
      }
    }

    void loadQueue();

    return () => {
      active = false;
    };
  }, [user, dailyLimit]);

  const handleGradeCard = React.useCallback(
    async (card: VocabCard, grade: SrsGrade) => {
      if (!user) {
        throw new Error("User must be signed in to record review.");
      }
      return recordVocabReview(user.uid, card, grade);
    },
    [user]
  );

  const handleExit = React.useCallback(() => {
    router.push("/vocab");
  }, [router]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/vocab">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Vocabulary</span>
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-12">
          <Card className="w-full">
            <CardContent className="p-6 text-center space-y-4">
              <h1 className="text-xl font-semibold text-foreground">
                Could not load review session
              </h1>
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button asChild>
                <Link href="/vocab">Return to Vocabulary Bank</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (sessionQueue === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-8 w-8" />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-12">
          <Skeleton className="h-72 w-full rounded-lg" />
        </main>
      </div>
    );
  }

  if (sessionQueue.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/vocab">
                <ArrowLeft className="h-4 w-4" />
                <span>Exit</span>
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-12">
          <Card className="w-full">
            <CardContent className="p-6 sm:p-8 text-center space-y-5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  All caught up!
                </h1>
                <p className="text-sm text-muted-foreground">
                  You have no due or new vocabulary cards scheduled for right
                  now.
                </p>
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
        </main>
      </div>
    );
  }

  return (
    <FlashcardReview
      initialQueue={sessionQueue}
      onGradeCard={handleGradeCard}
      onExit={handleExit}
    />
  );
}
