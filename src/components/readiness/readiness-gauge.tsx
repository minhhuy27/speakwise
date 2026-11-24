"use client";

import * as React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { ReadinessReport } from "@/lib/engines/readiness";
import { cn } from "@/lib/utils";
import { READINESS_VERDICT_LABELS } from "@/lib/validations/readiness";
import type { ReadinessVerdict } from "@/types/domain";

interface ReadinessGaugeProps {
  report: ReadinessReport;
  compact?: boolean;
}

interface VerdictStyle {
  textClass: string;
  barClass: string;
  strokeHex: string;
  badgeVariant: NonNullable<BadgeProps["variant"]>;
}

const VERDICT_STYLES: Record<ReadinessVerdict, VerdictStyle> = {
  needs_foundation: {
    textClass: "text-danger",
    barClass: "bg-danger",
    strokeHex: "#E11D48",
    badgeVariant: "danger",
  },
  approaching: {
    textClass: "text-warning",
    barClass: "bg-warning",
    strokeHex: "#D97706",
    badgeVariant: "warning",
  },
  almost_ready: {
    textClass: "text-info",
    barClass: "bg-info",
    strokeHex: "#0284C7",
    badgeVariant: "info",
  },
  exam_ready: {
    textClass: "text-success",
    barClass: "bg-success",
    strokeHex: "#059669",
    badgeVariant: "success",
  },
};

const GAUGE_RADIUS = 80;
const GAUGE_ARC_LENGTH = Math.PI * GAUGE_RADIUS;

export function ReadinessGauge({
  report,
  compact = false,
}: ReadinessGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, report.readinessIndex));
  const style = VERDICT_STYLES[report.verdict];
  const verdictLabel = READINESS_VERDICT_LABELS[report.verdict];
  const dashOffset = GAUGE_ARC_LENGTH * (1 - clampedScore / 100);

  const subScores = [
    {
      label: "Score Proximity · 55%",
      value: Math.max(0, Math.min(100, report.scoreReadiness)),
    },
    {
      label: "Consistency · 25%",
      value: Math.max(0, Math.min(100, report.stabilityScore)),
    },
    {
      label: "Pacing & Timeline · 20%",
      value: Math.max(0, Math.min(100, report.pacingScore)),
    },
  ];

  const hasSample = report.sampleSize > 0;
  const formattedWeightedAvg = hasSample
    ? `${Math.round(report.weightedAverage)}`
    : "—";
  const formattedStdDev = hasSample
    ? `±${report.stdDeviation.toFixed(1)}`
    : "—";
  const formattedTrend =
    report.sampleSize >= 2
      ? `${report.trendDelta >= 0 ? "+" : ""}${report.trendDelta.toFixed(1)}`
      : "—";

  return (
    <div className={cn("flex flex-col items-center", compact ? "gap-2" : "gap-5")}>
      <div className="relative flex flex-col items-center">
        <svg
          viewBox="0 0 200 120"
          className={cn(compact ? "h-28 w-48" : "h-36 w-60")}
          role="img"
          aria-label={`Exam readiness gauge: ${clampedScore}% (${verdictLabel})`}
        >
          <path
            d="M 20 106 A 80 80 0 0 1 180 106"
            fill="none"
            stroke="currentColor"
            className="text-muted"
            strokeWidth={14}
            strokeLinecap="round"
          />
          <path
            d="M 20 106 A 80 80 0 0 1 180 106"
            fill="none"
            stroke={style.strokeHex}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={GAUGE_ARC_LENGTH}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 450ms ease-out" }}
          />
        </svg>

        <div
          className={cn(
            "flex flex-col items-center text-center",
            compact ? "-mt-10" : "-mt-12"
          )}
        >
          <span
            className={cn(
              "font-bold font-mono tabular-nums tracking-tight",
              compact ? "text-2xl" : "text-4xl",
              style.textClass
            )}
          >
            {clampedScore}%
          </span>
          <Badge variant={style.badgeVariant} className="mt-1.5">
            {verdictLabel}
          </Badge>
        </div>
      </div>

      {!compact ? (
        <div className="w-full space-y-4">
          <div className="space-y-3">
            {subScores.map((item) => {
              const rounded = Math.round(item.value);
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-muted-foreground">
                      {rounded}%
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={item.label}
                    aria-valuenow={rounded}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={cn("h-full rounded-full transition-all", style.barClass)}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Weighted Avg
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {formattedWeightedAvg}
                {hasSample ? (
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                    /990
                  </span>
                ) : null}
              </p>
            </div>

            <div className="space-y-0.5 border-x border-border px-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Std Dev ±σ
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {formattedStdDev}
              </p>
            </div>

            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Trend Δ
              </p>
              <p
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums",
                  report.sampleSize >= 2
                    ? report.trendDelta >= 0
                      ? "text-success"
                      : "text-danger"
                    : "text-foreground"
                )}
              >
                {formattedTrend}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
