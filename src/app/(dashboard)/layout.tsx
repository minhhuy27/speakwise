"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardShellSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-card p-4 space-y-6">
        <Skeleton className="h-8 w-36" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="mt-auto space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>

      <div className="lg:pl-60 flex min-h-screen flex-col">
        <div className="lg:hidden h-14 border-b border-border bg-card px-4 flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-16" />
        </div>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
          <Skeleton className="h-56 rounded-lg" />
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();

  const needsOnboardingRedirect =
    !loading &&
    Boolean(user) &&
    Boolean(profile) &&
    !profile?.onboardingCompleted &&
    pathname !== "/settings";

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (needsOnboardingRedirect) {
      router.replace("/settings?onboarding=1");
    }
  }, [loading, user, needsOnboardingRedirect, router]);

  if (loading || !user || needsOnboardingRedirect) {
    return <DashboardShellSkeleton />;
  }

  if (pathname === "/vocab/review") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-60 flex min-h-screen flex-col">
        <MobileHeader />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
