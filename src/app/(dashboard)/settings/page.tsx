"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { GoalSettingsForm } from "@/components/settings/goal-settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { updateUserProfile } from "@/lib/firebase/repositories/profile";
import type { UserProfileFormValues } from "@/lib/validations/profile";

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();

  const isOnboarding =
    searchParams.get("onboarding") === "1" ||
    Boolean(profile && !profile.onboardingCompleted);

  if (!user) {
    return <SettingsSkeleton />;
  }

  async function handleSave(values: UserProfileFormValues) {
    if (!user) return;
    try {
      await updateUserProfile(user.uid, values);
      await refreshProfile();
      toast.success("Study goals saved");
      if (isOnboarding) {
        router.replace("/");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save study goals. Please try again.";
      toast.error(message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Study Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure your target TOEIC score, optional section goals, exam date,
          and daily vocabulary pace.
        </p>
      </div>

      {isOnboarding ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <CardTitle className="text-base">
                Welcome to SpeakWise
              </CardTitle>
            </div>
            <CardDescription className="text-foreground/80">
              Set your initial TOEIC L&amp;R study goals below to unlock your
              personalized dashboard and readiness tracking.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>TOEIC Target &amp; Daily Pace</CardTitle>
          <CardDescription>
            All scores follow official ETS TOEIC Listening &amp; Reading
            5-point increments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoalSettingsForm
            key={profile?.updatedAt ?? "initial"}
            initialProfile={profile ?? {}}
            isOnboarding={isOnboarding}
            onSave={handleSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </React.Suspense>
  );
}
