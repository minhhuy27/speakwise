"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Plus } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ERROR_CATEGORIES,
  ERROR_CATEGORY_LABELS,
} from "@/lib/validations/mistake";
import type { ErrorCategory, MistakeRecord } from "@/types/domain";

interface ErrorCategoryChartProps {
  mistakes: MistakeRecord[];
}

interface ErrorCategoryDatum {
  category: ErrorCategory;
  label: string;
  count: number;
  sharePercent: number;
  color: string;
}

const CATEGORY_COLORS: Record<ErrorCategory, string> = {
  vocab: "#4F46E5",
  grammar: "#0284C7",
  listening_trap: "#D97706",
  inference: "#059669",
  time_pressure: "#E11D48",
  careless: "#64748B",
};

interface ErrorTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ErrorCategoryDatum }>;
}

function ErrorCategoryTooltip({ active, payload }: ErrorTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0]?.payload;
  if (!item) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold text-foreground">{item.label}</p>
      <p className="mt-1 font-mono tabular-nums text-muted-foreground">
        {item.count} {item.count === 1 ? "mistake" : "mistakes"} (
        {item.sharePercent}%)
      </p>
    </div>
  );
}

export function ErrorCategoryChart({ mistakes }: ErrorCategoryChartProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const totalMistakes = mistakes.length;

  const data = React.useMemo<ErrorCategoryDatum[]>(() => {
    if (totalMistakes === 0) return [];

    const counts: Record<ErrorCategory, number> = {
      vocab: 0,
      grammar: 0,
      listening_trap: 0,
      inference: 0,
      time_pressure: 0,
      careless: 0,
    };

    for (const mistake of mistakes) {
      if (mistake.errorCategory in counts) {
        counts[mistake.errorCategory] += 1;
      }
    }

    return ERROR_CATEGORIES.map((category) => {
      const count = counts[category];
      return {
        category,
        label: ERROR_CATEGORY_LABELS[category],
        count,
        sharePercent: Math.round((count / totalMistakes) * 100),
        color: CATEGORY_COLORS[category],
      };
    }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [mistakes, totalMistakes]);

  if (totalMistakes === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center">
        <AlertCircle className="h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">
          No mistake records logged yet
        </p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Log missed questions inside any TOEIC test attempt to uncover your top
          error patterns.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href="/tests">
            <Plus className="h-3.5 w-3.5" />
            <span>Open Test Log</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5 lg:items-center">
      <div className="h-64 w-full lg:col-span-3">
        {!mounted ? (
          <Skeleton className="h-full w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 16, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                className="stroke-border"
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={108}
                tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                content={<ErrorCategoryTooltip />}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {data.map((entry) => (
                  <Cell key={entry.category} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="space-y-2.5 lg:col-span-2">
        {data.map((item) => (
          <div
            key={item.category}
            className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate font-medium text-foreground">
                {item.label}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span className="font-semibold text-foreground">{item.count}</span>
              <span className="w-10 text-right text-muted-foreground">
                {item.sharePercent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
