"use client";

import Link from "next/link";
import { Settings, Target } from "lucide-react";
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

export default function ReadinessPage() {
  const { profile } = useAuth();
  const targetScore = profile?.targetScore ?? 750;
  const daysRemaining = daysUntilDate(profile?.targetExamDate);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Exam Readiness
          </h1>
          <Badge variant="secondary">Phase 4 Preview</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Evaluate mock test consistency, part weaknesses, and countdown pacing.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Target className="h-5 w-5" />
          </div>
          <CardTitle className="pt-2">
            Readiness diagnostics will appear here
          </CardTitle>
          <CardDescription className="max-w-xl">
            Once vocabulary mastery and mock tests are logged, SpeakWise will
            compute your Exam Readiness Index relative to your{" "}
            <span className="font-mono font-medium text-foreground tabular-nums">
              {targetScore}
            </span>{" "}
            target
            {daysRemaining !== null
              ? ` (${daysRemaining} days remaining)`
              : ""}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span>Configure exam goals</span>
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
