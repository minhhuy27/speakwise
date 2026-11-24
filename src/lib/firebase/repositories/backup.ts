import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { buildBackupPayload, stripUndefinedDeep } from "@/lib/backup";
import { getFirebaseDb } from "@/lib/firebase/client";
import { listAllUserMistakes } from "@/lib/firebase/repositories/mistakes";
import { updateUserProfile } from "@/lib/firebase/repositories/profile";
import { listUserTests } from "@/lib/firebase/repositories/tests";
import { listUserVocab } from "@/lib/firebase/repositories/vocab";
import type { SpeakWiseBackupPayload } from "@/lib/validations/backup";
import type { MistakeRecord, UserProfile } from "@/types/domain";

const MAX_OPS_PER_BATCH = 400;

export type BackupRestoreMode = "merge" | "replace";

export interface ImportUserBackupOptions {
  mode: BackupRestoreMode;
  restoreProfileGoals: boolean;
}

export interface ImportUserBackupResult {
  vocabCount: number;
  testsCount: number;
  mistakesCount: number;
}

type BatchOp =
  | {
      type: "set";
      ref: DocumentReference;
      data: Record<string, unknown>;
    }
  | {
      type: "update";
      ref: DocumentReference;
      data: Record<string, unknown>;
    }
  | {
      type: "delete";
      ref: DocumentReference;
    };

function requireDb(): Firestore {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error(
      "Firestore is not configured. Check your environment variables."
    );
  }
  return db;
}

async function commitBatchedOps(db: Firestore, ops: BatchOp[]): Promise<void> {
  for (let i = 0; i < ops.length; i += MAX_OPS_PER_BATCH) {
    const batch = writeBatch(db);
    const chunk = ops.slice(i, i + MAX_OPS_PER_BATCH);

    for (const op of chunk) {
      if (op.type === "set") {
        batch.set(op.ref, op.data);
      } else if (op.type === "update") {
        batch.update(op.ref, op.data);
      } else {
        batch.delete(op.ref);
      }
    }

    await batch.commit();
  }
}

function countMistakesByTestId(
  mistakes: Iterable<Pick<MistakeRecord, "testId">>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const mistake of mistakes) {
    counts.set(mistake.testId, (counts.get(mistake.testId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Exports all user vocabulary, tests, mistakes, and optional profile goals as a validated backup payload.
 */
export async function exportUserBackup(
  uid: string,
  profile?: UserProfile | null
): Promise<SpeakWiseBackupPayload> {
  const [vocab, tests, mistakes] = await Promise.all([
    listUserVocab(uid),
    listUserTests(uid),
    listAllUserMistakes(uid),
  ]);

  return buildBackupPayload({
    profile,
    vocab,
    tests,
    mistakes,
  });
}

/**
 * Restores a validated SpeakWise backup payload into Firestore using chunked write batches.
 */
export async function importUserBackup(
  uid: string,
  payload: SpeakWiseBackupPayload,
  options: ImportUserBackupOptions
): Promise<ImportUserBackupResult> {
  const db = requireDb();
  const ops: BatchOp[] = [];

  if (options.mode === "replace") {
    const [existingVocabSnap, existingTestsSnap, existingMistakesSnap] =
      await Promise.all([
        getDocs(collection(db, "users", uid, "vocab")),
        getDocs(collection(db, "users", uid, "tests")),
        getDocs(collection(db, "users", uid, "mistakes")),
      ]);

    const importedVocabIds = new Set(payload.vocab.map((card) => card.id));
    const importedTestIds = new Set(payload.tests.map((test) => test.id));
    const importedMistakeIds = new Set(payload.mistakes.map((m) => m.id));

    for (const snap of existingVocabSnap.docs) {
      if (!importedVocabIds.has(snap.id)) {
        ops.push({ type: "delete", ref: snap.ref });
      }
    }
    for (const snap of existingTestsSnap.docs) {
      if (!importedTestIds.has(snap.id)) {
        ops.push({ type: "delete", ref: snap.ref });
      }
    }
    for (const snap of existingMistakesSnap.docs) {
      if (!importedMistakeIds.has(snap.id)) {
        ops.push({ type: "delete", ref: snap.ref });
      }
    }

    const mistakeCounts = countMistakesByTestId(payload.mistakes);

    for (const card of payload.vocab) {
      ops.push({
        type: "set",
        ref: doc(db, "users", uid, "vocab", card.id),
        data: stripUndefinedDeep({ ...card }),
      });
    }

    for (const test of payload.tests) {
      ops.push({
        type: "set",
        ref: doc(db, "users", uid, "tests", test.id),
        data: stripUndefinedDeep({
          ...test,
          mistakeCount: mistakeCounts.get(test.id) ?? 0,
        }),
      });
    }

    for (const mistake of payload.mistakes) {
      ops.push({
        type: "set",
        ref: doc(db, "users", uid, "mistakes", mistake.id),
        data: stripUndefinedDeep({ ...mistake }),
      });
    }
  } else {
    const [existingTests, existingMistakes] = await Promise.all([
      listUserTests(uid),
      listAllUserMistakes(uid),
    ]);

    const mergedMistakesById = new Map<string, MistakeRecord>();
    for (const existing of existingMistakes) {
      mergedMistakesById.set(existing.id, existing);
    }
    for (const imported of payload.mistakes) {
      mergedMistakesById.set(imported.id, imported);
    }

    const mistakeCounts = countMistakesByTestId(mergedMistakesById.values());
    const importedTestIds = new Set(payload.tests.map((test) => test.id));

    for (const card of payload.vocab) {
      ops.push({
        type: "set",
        ref: doc(db, "users", uid, "vocab", card.id),
        data: stripUndefinedDeep({ ...card }),
      });
    }

    for (const test of payload.tests) {
      ops.push({
        type: "set",
        ref: doc(db, "users", uid, "tests", test.id),
        data: stripUndefinedDeep({
          ...test,
          mistakeCount: mistakeCounts.get(test.id) ?? 0,
        }),
      });
    }

    for (const existingTest of existingTests) {
      if (importedTestIds.has(existingTest.id)) {
        continue;
      }
      const nextCount = mistakeCounts.get(existingTest.id) ?? 0;
      if (nextCount !== existingTest.mistakeCount) {
        ops.push({
          type: "update",
          ref: doc(db, "users", uid, "tests", existingTest.id),
          data: { mistakeCount: nextCount },
        });
      }
    }

    for (const mistake of payload.mistakes) {
      ops.push({
        type: "set",
        ref: doc(db, "users", uid, "mistakes", mistake.id),
        data: stripUndefinedDeep({ ...mistake }),
      });
    }
  }

  await commitBatchedOps(db, ops);

  if (options.restoreProfileGoals && payload.profile) {
    await updateUserProfile(uid, payload.profile);
  }

  return {
    vocabCount: payload.vocab.length,
    testsCount: payload.tests.length,
    mistakesCount: payload.mistakes.length,
  };
}
