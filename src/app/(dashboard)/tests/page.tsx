"use client";

import Link from "next/link";
import { ClipboardCheck, Settings } from "lucide-react";
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

export default function TestsPage() {
  const { profile } = useAuth();
  const targetScore = profile?.targetScore ?? 750;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            TOEIC Test Log
          </h1>
          <Badge variant="secondary">Phase 3 Preview</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Record mock exam scores, part-by-part accuracy, and categorized
          mistakes.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <CardTitle className="pt-2">No test attempts logged yet</CardTitle>
          <CardDescription className="max-w-xl">
            Upcoming test logging will track full 200-question simulations and
            mini-part drills against your{" "}
            <span className="font-mono font-medium text-foreground tabular-nums">
              {targetScore}
            </span>{" "}
            target score, linking missed questions directly to vocabulary cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span>Update target score</span>
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
