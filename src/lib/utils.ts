import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Computes whole calendar days remaining from `now` until `isoDate` (`YYYY-MM-DD`).
 * Returns `null` if `isoDate` is missing or invalid.
 */
export function daysUntilDate(
  isoDate: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!isoDate) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const targetUtc = Date.UTC(year, month - 1, day);
  const parsed = new Date(targetUtc);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 86_400_000;
  return Math.round((targetUtc - todayUtc) / msPerDay);
}
