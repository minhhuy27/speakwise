"use client";

import Link from "next/link";
import { BookOpen, Settings } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VocabPage() {
  const { profile } = useAuth();
  const dailyLimit = profile?.dailyNewWordsLimit ?? 15;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Vocabulary Bank
          </h1>
          <Badge variant="secondary">Phase 2 Preview</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Bilingual TOEIC business vocabulary with SM-2 spaced repetition.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <CardTitle className="pt-2">
            Your bilingual SRS deck is ready to be populated
          </CardTitle>
          <CardDescription className="max-w-xl">
            In the next module, you will be able to add TOEIC words with
            English definitions, Vietnamese meanings, IPA, audio playback, and
            study up to{" "}
            <span className="font-mono font-medium text-foreground tabular-nums">
              {dailyLimit}
            </span>{" "}
            new words per day.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span>Adjust daily word limit</span>
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to Overview</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
