"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

function getRouteTitle(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/vocab")) return "Vocabulary Bank";
  if (pathname.startsWith("/tests")) return "TOEIC Test Log";
  if (pathname.startsWith("/readiness")) return "Exam Readiness";
  if (pathname.startsWith("/settings")) return "Study Settings";
  return "SpeakWise";
}

export function MobileHeader() {
  const pathname = usePathname();
  const title = getRouteTitle(pathname);

  return (
    <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex items-center gap-2.5 min-w-0">
        <Link
          href="/"
          aria-label="SpeakWise home"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <GraduationCap className="h-4 w-4" />
        </Link>
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button asChild variant="ghost" size="icon" className="h-9 w-9">
          <Link href="/settings" aria-label="Open settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
