"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TestAttempt } from "@/types/domain";

interface ScoreTrendChartProps {
  fullTests: TestAttempt[];
  targetScore: number;
  mini?: boolean;
}

interface ScoreTrendPoint {
  id: string;
  label: string;
  title: string;
  takenAt: string;
  totalScore: number;
  listeningScore: number;
  readingScore: number;
}

function compareIsoStrings(a: string, b: string): number {
  const timeA = Date.parse(a);
  const timeB = Date.parse(b);
  if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareTestsAscending(a: TestAttempt, b: TestAttempt): number {
  const takenCmp = compareIsoStrings(a.takenAt, b.takenAt);
  if (takenCmp !== 0) return takenCmp;

  const createdCmp = compareIsoStrings(a.createdAt, b.createdAt);
  if (createdCmp !== 0) return createdCmp;

  return a.id.localeCompare(b.id);
}

function formatShortDate(takenAt: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(takenAt.trim());
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return takenAt.slice(0, 10) || "Undated";
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: ScoreTrendPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}

function ScoreTrendTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold text-foreground">{point.title}</p>
      <p className="mb-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
        {point.takenAt}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#4F46E5]" />
            Total
          </span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {point.totalScore} / 990
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#0284C7]" />
            Listening
          </span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {point.listeningScore} / 495
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#059669]" />
            Reading
          </span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {point.readingScore} / 495
          </span>
        </div>
      </div>
    </div>
  );
}

export function ScoreTrendChart({
  fullTests,
  targetScore,
  mini = false,
}: ScoreTrendChartProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = React.useMemo<ScoreTrendPoint[]>(() => {
    const sorted = fullTests
      .filter((test) => test.mode === "full_test")
      .sort(compareTestsAscending);
    const sliced = mini ? sorted.slice(-5) : sorted.slice(-12);
    return sliced.map((test) => ({
      id: test.id,
      label: formatShortDate(test.takenAt),
      title: test.title,
      takenAt: test.takenAt,
      totalScore: test.totalScore,
      listeningScore: test.listeningScore,
      readingScore: test.readingScore,
    }));
  }, [fullTests, mini]);

  if (chartData.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center",
          mini ? "h-48" : "h-64"
        )}
      >
        <ClipboardCheck className="h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">
          No full-length mock tests logged yet
        </p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Log your first 200-question TOEIC full test to plot your Total,
          Listening, and Reading trajectory.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href="/tests">
            <Plus className="h-3.5 w-3.5" />
            <span>Log Full Test</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("w-full", mini ? "h-48" : "h-64")}>
      {!mounted ? (
        <Skeleton className="h-full w-full rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 16, left: -8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 990]}
              ticks={[0, 300, 500, 700, 990]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ScoreTrendTooltip />} />
            {!mini ? (
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "6px" }}
              />
            ) : null}
            <ReferenceLine
              y={targetScore}
              stroke="#D97706"
              strokeDasharray="4 4"
              label={{
                value: `Target ${targetScore}`,
                position: "insideTopRight",
                fill: "#D97706",
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="totalScore"
              name="Total"
              stroke="#4F46E5"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: "#4F46E5" }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="listeningScore"
              name="Listening"
              stroke="#0284C7"
              strokeWidth={1.75}
              dot={{ r: 2.5, fill: "#0284C7" }}
            />
            <Line
              type="monotone"
              dataKey="readingScore"
              name="Reading"
              stroke="#059669"
              strokeWidth={1.75}
              dot={{ r: 2.5, fill: "#059669" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
