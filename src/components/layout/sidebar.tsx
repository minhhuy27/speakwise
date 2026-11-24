"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Target,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const PRIMARY_NAV_ITEMS = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Vocabulary", href: "/vocab", icon: BookOpen },
  { label: "Test Log", href: "/tests", icon: ClipboardCheck },
  { label: "Readiness", href: "/readiness", icon: Target },
] as const;

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name || email || "SW").trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();

  const displayName = profile?.displayName || user?.displayName || "TOEIC Learner";
  const email = profile?.email || user?.email || "";
  const photoURL = profile?.photoURL || user?.photoURL || undefined;
  const initials = getInitials(displayName, email);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-card">
      <div className="flex h-16 items-center justify-between px-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            SpeakWise
          </span>
        </Link>
        <Badge variant="secondary" className="text-[11px] font-medium">
          TOEIC L&amp;R
        </Badge>
      </div>

      <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-3 py-4">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <Separator className="my-3" />

        <div className="flex items-center justify-between gap-2">
          <Link
            href="/settings"
            className={cn(
              "flex flex-1 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive("/settings")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            {photoURL ? <AvatarImage src={photoURL} alt={displayName} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {displayName}
            </p>
            {email ? (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void signOut()}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </Button>
      </div>
    </aside>
  );
}
