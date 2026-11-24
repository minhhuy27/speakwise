"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, Plus } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReadinessReport } from "@/lib/engines/readiness";
import type { ToeicPartKey } from "@/types/domain";

interface PartAccuracyChartProps {
  partAccuracies: ReadinessReport["partAccuracies"];
  weakParts: ToeicPartKey[];
  targetScore: number;
}

const PART_ORDER: readonly { key: ToeicPartKey; label: string; name: string }[] =
  [
    { key: "part1", label: "Part 1", name: "Photographs" },
    { key: "part2", label: "Part 2", name: "Question-Response" },
    { key: "part3", label: "Part 3", name: "Conversations" },
    { key: "part4", label: "Part 4", name: "Short Talks" },
    { key: "part5", label: "Part 5", name: "Incomplete Sentences" },
    { key: "part6", label: "Part 6", name: "Text Completion" },
    { key: "part7", label: "Part 7", name: "Reading Comprehension" },
  ];

interface PartChartPoint {
  key: ToeicPartKey;
  label: string;
  name: string;
  accuracyPercent: number;
  correct: number;
  total: number;
  attempted: boolean;
  isWeak: boolean;
}

interface PartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: PartChartPoint }>;
}

function PartAccuracyTooltip({ active, payload }: PartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold text-foreground">
        {point.label}: {point.name}
      </p>
      {point.attempted ? (
        <div className="mt-1 space-y-0.5">
          <p className="font-mono font-semibold tabular-nums text-foreground">
            {point.accuracyPercent}% accuracy
          </p>
          <p className="font-mono tabular-nums text-muted-foreground">
            {point.correct} / {point.total} correct
          </p>
          {point.isWeak ? (
            <p className="text-[11px] font-medium text-danger">
              Priority focus part
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-muted-foreground">Not attempted yet</p>
      )}
    </div>
  );
}

export function PartAccuracyChart({
  partAccuracies,
  weakParts,
  targetScore,
}: PartAccuracyChartProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const weakSet = React.useMemo(() => new Set(weakParts), [weakParts]);

  const data = React.useMemo<PartChartPoint[]>(() => {
    return PART_ORDER.map(({ key, label, name }) => {
      const summary = partAccuracies[key];
      const attempted = Boolean(summary && summary.total > 0);
      const accuracyPercent =
        attempted && summary.accuracy !== null
          ? Math.round(summary.accuracy * 100)
          : 0;
      return {
        key,
        label,
        name,
        accuracyPercent,
        correct: summary?.correct ?? 0,
        total: summary?.total ?? 0,
        attempted,
        isWeak: weakSet.has(key),
      };
    });
  }, [partAccuracies, weakSet]);

  const hasAnyAttempts = data.some((item) => item.attempted);
  const targetAccuracyPct = Math.min(
    92,
    Math.max(45, Math.round((targetScore / 990) * 100))
  );

  if (!hasAnyAttempts) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center">
        <BarChart3 className="h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">
          No Part-by-Part accuracy data yet
        </p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Log a Full Test or Part Drill with question counts to pinpoint weak
          TOEIC parts.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href="/tests">
            <Plus className="h-3.5 w-3.5" />
            <span>Log Test or Drill</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-64 w-full">
        {!mounted ? (
          <Skeleton className="h-full w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-border"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(value: number) => `${value}%`}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                content={<PartAccuracyTooltip />}
              />
              <ReferenceLine
                y={targetAccuracyPct}
                stroke="#0284C7"
                strokeDasharray="4 4"
                label={{
                  value: `Target ${targetAccuracyPct}%`,
                  position: "insideTopRight",
                  fill: "#0284C7",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="accuracyPercent" radius={[4, 4, 0, 0]} maxBarSize={38}>
                {data.map((entry) => {
                  let fill = "#94A3B8";
                  if (entry.attempted) {
                    if (entry.isWeak) {
                      fill = entry.accuracyPercent < 60 ? "#E11D48" : "#D97706";
                    } else {
                      fill =
                        entry.accuracyPercent >= targetAccuracyPct
                          ? "#059669"
                          : "#4F46E5";
                    }
                  }
                  return <Cell key={entry.key} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#059669]" />
          On / Above Target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#4F46E5]" />
          Solid
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#D97706]" />
          Weak (&ge;60%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#E11D48]" />
          Critical (&lt;60%)
        </span>
      </div>
    </div>
  );
}
