import {
  SPEAKWISE_BACKUP_VERSION,
  speakwiseBackupSchema,
  type SpeakWiseBackupPayload,
} from "@/lib/validations/backup";
import type { UserProfileFormValues } from "@/lib/validations/profile";
import type {
  MistakeRecord,
  TestAttempt,
  UserProfile,
  VocabCard,
} from "@/types/domain";

export interface BuildBackupPayloadInput {
  profile?: UserProfile | null;
  vocab: VocabCard[];
  tests: TestAttempt[];
  mistakes: MistakeRecord[];
  now?: Date;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively strips `undefined` properties from plain objects while preserving
 * `null`, primitives, and arrays.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }

  if (isPlainObject(value)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if (entryValue !== undefined) {
        cleaned[key] = stripUndefinedDeep(entryValue);
      }
    }
    return cleaned as T;
  }

  return value;
}

function extractProfileGoals(
  profile?: UserProfile | null
): UserProfileFormValues | undefined {
  if (!profile) {
    return undefined;
  }

  return {
    targetScore: profile.targetScore,
    targetListening: profile.targetListening ?? null,
    targetReading: profile.targetReading ?? null,
    targetExamDate: profile.targetExamDate ?? null,
    dailyNewWordsLimit: profile.dailyNewWordsLimit,
  };
}

/**
 * Builds a validated, clean SpeakWise backup payload.
 */
export function buildBackupPayload({
  profile,
  vocab,
  tests,
  mistakes,
  now,
}: BuildBackupPayloadInput): SpeakWiseBackupPayload {
  const exportedAt = (now ?? new Date()).toISOString();
  const profileGoals = extractProfileGoals(profile);

  const rawPayload = {
    app: "speakwise" as const,
    version: SPEAKWISE_BACKUP_VERSION,
    exportedAt,
    ...(profileGoals ? { profile: profileGoals } : {}),
    vocab: stripUndefinedDeep(vocab),
    tests: stripUndefinedDeep(tests),
    mistakes: stripUndefinedDeep(mistakes),
  };

  const parsed = speakwiseBackupSchema.parse(rawPayload);
  return stripUndefinedDeep(parsed);
}

/**
 * Serializes a validated backup payload as formatted JSON.
 */
export function serializeBackupPayload(payload: SpeakWiseBackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * Parses and validates a raw JSON string into a SpeakWise backup payload.
 * Throws a clear English Error on malformed JSON or schema violations.
 */
export function parseAndValidateBackupJson(
  rawJson: string
): SpeakWiseBackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(
      "Malformed JSON file. Please select a valid SpeakWise backup (.json)."
    );
  }

  const result = speakwiseBackupSchema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const pathPrefix =
      firstIssue && firstIssue.path.length > 0
        ? `${firstIssue.path.join(".")}: `
        : "";
    const detail = firstIssue?.message ?? "Schema validation failed.";
    throw new Error(`Invalid SpeakWise backup file (${pathPrefix}${detail}).`);
  }

  return stripUndefinedDeep(result.data);
}

/**
 * Triggers a browser download for a validated SpeakWise backup JSON file.
 */
export function downloadBackupFile(payload: SpeakWiseBackupPayload): void {
  const json = serializeBackupPayload(payload);
  const datePrefix =
    /^\d{4}-\d{2}-\d{2}/.test(payload.exportedAt)
      ? payload.exportedAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const filename = `speakwise-backup-${datePrefix}.json`;

  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
