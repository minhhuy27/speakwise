"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  userProfileFormSchema,
  type UserProfileFormValues,
} from "@/lib/validations/profile";
import type { UserProfile } from "@/types/domain";

const TARGET_SCORE_PRESETS = [550, 650, 750, 850, 900] as const;

export interface GoalSettingsFormProps {
  initialProfile: Partial<UserProfile>;
  isOnboarding?: boolean;
  onSave: (values: UserProfileFormValues) => Promise<void>;
}

export function GoalSettingsForm({
  initialProfile,
  isOnboarding = false,
  onSave,
}: GoalSettingsFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserProfileFormValues>({
    resolver: zodResolver(userProfileFormSchema),
    defaultValues: {
      targetScore: initialProfile.targetScore ?? 750,
      targetListening: initialProfile.targetListening ?? null,
      targetReading: initialProfile.targetReading ?? null,
      targetExamDate: initialProfile.targetExamDate ?? null,
      dailyNewWordsLimit: initialProfile.dailyNewWordsLimit ?? 15,
    },
  });

  const watchedTargetScore = Number(watch("targetScore"));

  async function handleFormSubmit(values: UserProfileFormValues) {
    const normalized: UserProfileFormValues = {
      targetScore: values.targetScore,
      targetListening: values.targetListening ?? null,
      targetReading: values.targetReading ?? null,
      targetExamDate: values.targetExamDate ?? null,
      dailyNewWordsLimit: values.dailyNewWordsLimit,
    };
    await onSave(normalized);
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6"
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="targetScore">Target Total Score</Label>
          <Input
            id="targetScore"
            type="number"
            min={10}
            max={990}
            step={5}
            className="tabular-nums font-mono"
            aria-invalid={Boolean(errors.targetScore)}
            {...register("targetScore")}
          />
          <p className="text-xs text-muted-foreground">
            Choose a TOEIC L&amp;R target between 10 and 990 in increments of 5.
          </p>
          {errors.targetScore ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.targetScore.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Quick presets:
          </span>
          {TARGET_SCORE_PRESETS.map((preset) => {
            const active = watchedTargetScore === preset;
            return (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() =>
                  setValue("targetScore", preset, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                className={cn("h-8 px-3 tabular-nums font-mono text-xs")}
              >
                {preset}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="targetListening">Target Listening Score</Label>
          <Input
            id="targetListening"
            type="number"
            min={5}
            max={495}
            step={5}
            placeholder="Optional (5-495)"
            className="tabular-nums font-mono"
            aria-invalid={Boolean(errors.targetListening)}
            {...register("targetListening")}
          />
          {errors.targetListening ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.targetListening.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetReading">Target Reading Score</Label>
          <Input
            id="targetReading"
            type="number"
            min={5}
            max={495}
            step={5}
            placeholder="Optional (5-495)"
            className="tabular-nums font-mono"
            aria-invalid={Boolean(errors.targetReading)}
            {...register("targetReading")}
          />
          {errors.targetReading ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.targetReading.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="targetExamDate">Target Exam Date</Label>
          <Input
            id="targetExamDate"
            type="date"
            className="tabular-nums"
            aria-invalid={Boolean(errors.targetExamDate)}
            {...register("targetExamDate")}
          />
          <p className="text-xs text-muted-foreground">
            Optional date used for countdown and pacing.
          </p>
          {errors.targetExamDate ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.targetExamDate.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dailyNewWordsLimit">Daily New Vocabulary Limit</Label>
          <Input
            id="dailyNewWordsLimit"
            type="number"
            min={5}
            max={50}
            step={1}
            className="tabular-nums font-mono"
            aria-invalid={Boolean(errors.dailyNewWordsLimit)}
            {...register("dailyNewWordsLimit")}
          />
          <p className="text-xs text-muted-foreground">
            Recommended 10-20 new words per day (5 to 50).
          </p>
          {errors.dailyNewWordsLimit ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.dailyNewWordsLimit.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : isOnboarding ? (
            "Save goals & continue"
          ) : (
            "Save study goals"
          )}
        </Button>
      </div>
    </form>
  );
}
