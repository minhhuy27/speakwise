"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  Target,
} from "lucide-react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";

const FEATURE_HIGHLIGHTS = [
  {
    icon: BookOpen,
    title: "Bilingual SRS Vocabulary",
    description:
      "Review high-frequency TOEIC business terms with SM-2 spaced repetition and English-Vietnamese context.",
  },
  {
    icon: ClipboardCheck,
    title: "TOEIC Test & Mistake Log",
    description:
      "Record full and section mock scores while categorizing recurring listening and reading errors.",
  },
  {
    icon: Target,
    title: "Exam Readiness Index",
    description:
      "Track score momentum against your target band and remaining days before test day.",
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading, isConfigured, signIn } = useAuth();
  const [isSigningIn, setIsSigningIn] = React.useState(false);

  React.useEffect(() => {
    if (loading || !user) return;

    if (profile && !profile.onboardingCompleted) {
      router.replace("/settings?onboarding=1");
      return;
    }

    router.replace("/");
  }, [loading, user, profile, router]);

  async function handleGoogleSignIn() {
    setIsSigningIn(true);
    try {
      await signIn();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sign in with Google. Please try again.";
      toast.error(message);
    } finally {
      setIsSigningIn(false);
    }
  }

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-11 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <CardTitle className="text-2xl font-bold tracking-tight">
                  SpeakWise
                </CardTitle>
                <Badge variant="secondary">TOEIC L&amp;R</Badge>
              </div>
              <CardDescription>
                A focused academic workspace for Listening &amp; Reading mastery.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {FEATURE_HIGHLIGHTS.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.title}
                    className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {feature.title}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={!isConfigured || isSigningIn}
              onClick={() => void handleGoogleSignIn()}
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Continue with Google</span>
              )}
            </Button>
          </CardContent>
        </Card>

        {!isConfigured ? (
          <Card className="border-warning/40 bg-warning/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-warning">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  Firebase environment setup required
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed text-muted-foreground space-y-1.5">
              <p>
                Authentication is currently disabled because Firebase client
                environment variables are missing.
              </p>
              <p>
                Copy <code className="font-mono text-foreground">.env.example</code>{" "}
                to <code className="font-mono text-foreground">.env.local</code>,
                fill in your <code className="font-mono text-foreground">NEXT_PUBLIC_FIREBASE_*</code>{" "}
                keys, and restart the development server.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
