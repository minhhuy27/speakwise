"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ClipboardCheck,
  Settings,
  Target,
} from "lucide-react";
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
import { daysUntilDate } from "@/lib/utils";

export default function OverviewPage() {
  const { profile, user } = useAuth();
  const displayName = profile?.displayName || user?.displayName || "TOEIC Learner";
  const targetScore = profile?.targetScore ?? 750;
  const dailyLimit = profile?.dailyNewWordsLimit ?? 15;
  const targetExamDate = profile?.targetExamDate ?? null;
  const daysRemaining = daysUntilDate(targetExamDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {displayName}. Your TOEIC L&amp;R study workspace is
            ready.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            <span>Edit study goals</span>
          </Link>
        </Button>
      </div>

      <section
        aria-label="Study goal summary"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Target TOEIC Score</CardDescription>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold font-mono tabular-nums">
              {targetScore}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                / 990
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile?.targetListening || profile?.targetReading ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                Listening: {profile?.targetListening ?? "—"} &middot; Reading:{" "}
                {profile?.targetReading ?? "—"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Optional section targets can be set in Settings.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Exam Countdown</CardDescription>
              <Calendar className="h-4 w-4 text-info" />
            </div>
            <CardTitle className="text-3xl font-bold font-mono tabular-nums">
              {daysRemaining !== null ? (
                daysRemaining >= 0 ? (
                  <>
                    {daysRemaining}
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      {daysRemaining === 1 ? "day left" : "days left"}
                    </span>
                  </>
                ) : (
                  <span className="text-xl font-semibold text-warning">
                    Date passed
                  </span>
                )
              ) : (
                <span className="text-xl font-semibold text-muted-foreground">
                  Not scheduled
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground tabular-nums">
              {targetExamDate
                ? `Target exam date: ${targetExamDate}`
                : "Add a target exam date in Settings to track countdown."}
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Daily New Vocabulary</CardDescription>
              <BookOpen className="h-4 w-4 text-success" />
            </div>
            <CardTitle className="text-3xl font-bold font-mono tabular-nums">
              {dailyLimit}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                words / day
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Pacing limit for upcoming SM-2 spaced repetition sessions.
            </p>
          </CardContent>
        </Card>
      </section>

      <section
        aria-label="Study modules"
        className="grid gap-4 md:grid-cols-3"
      >
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <BookOpen className="h-5 w-5 text-primary" />
              <Badge variant="outline">Phase 2</Badge>
            </div>
            <CardTitle className="pt-2">Vocabulary Bank</CardTitle>
            <CardDescription>
              Build your bilingual TOEIC deck with phonetic IPA, collocations,
              and SM-2 spaced repetition reviews.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost" className="px-0 text-primary">
              <Link href="/vocab">
                <span>Open Vocabulary Bank</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <Badge variant="outline">Phase 3</Badge>
            </div>
            <CardTitle className="pt-2">TOEIC Test Log</CardTitle>
            <CardDescription>
              Log ETS full tests or mini-part drills and capture recurring
              mistakes to turn weaknesses into flashcards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost" className="px-0 text-primary">
              <Link href="/tests">
                <span>Open Test Log</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Target className="h-5 w-5 text-primary" />
              <Badge variant="outline">Phase 4</Badge>
            </div>
            <CardTitle className="pt-2">Exam Readiness</CardTitle>
            <CardDescription>
              Measure how close your recent scores and mastery metrics are to
              your {targetScore}-point target.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost" className="px-0 text-primary">
              <Link href="/readiness">
                <span>View Readiness</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
