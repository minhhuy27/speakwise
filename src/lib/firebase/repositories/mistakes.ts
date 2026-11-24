import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  type FieldValue,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { MistakeFormValues } from "@/lib/validations/mistake";
import type { MistakeRecord, TestAttempt } from "@/types/domain";

function requireDb() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error(
      "Firestore is not configured. Check your environment variables."
    );
  }
  return db;
}

function getMistakesCollectionRef(uid: string) {
  return collection(requireDb(), "users", uid, "mistakes");
}

function getMistakeDocRef(uid: string, mistakeId: string) {
  return doc(requireDb(), "users", uid, "mistakes", mistakeId);
}

function normalizeOptionalString(
  value: string | null | undefined
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalQuestionNumber(
  value: number | null | undefined
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function mapMistakeDoc(snap: QueryDocumentSnapshot): MistakeRecord {
  const data = snap.data() as Omit<MistakeRecord, "id"> & { id?: string };
  return {
    ...data,
    id: snap.id,
  };
}

function sortMistakesForTest(mistakes: MistakeRecord[]): MistakeRecord[] {
  return [...mistakes].sort((a, b) => {
    if (a.part !== b.part) {
      return a.part - b.part;
    }
    const qA = a.questionNumber ?? 999;
    const qB = b.questionNumber ?? 999;
    if (qA !== qB) {
      return qA - qB;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function sortMistakesDesc(mistakes: MistakeRecord[]): MistakeRecord[] {
  return [...mistakes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Lists all mistake records for a specific test attempt, sorted by Part, question number, and creation time.
 */
export async function listMistakesByTest(
  uid: string,
  testId: string
): Promise<MistakeRecord[]> {
  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const mistakesQuery = query(
    collection(db, "users", uid, "mistakes"),
    where("testId", "==", testId)
  );
  const snapshot = await getDocs(mistakesQuery);
  return sortMistakesForTest(snapshot.docs.map(mapMistakeDoc));
}

/**
 * Subscribes to real-time mistake records for a specific test attempt.
 */
export function subscribeMistakesByTest(
  uid: string,
  testId: string,
  onNext: (mistakes: MistakeRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onNext([]);
    return () => {};
  }

  const mistakesQuery = query(
    collection(db, "users", uid, "mistakes"),
    where("testId", "==", testId)
  );

  return onSnapshot(
    mistakesQuery,
    (snapshot) => {
      onNext(sortMistakesForTest(snapshot.docs.map(mapMistakeDoc)));
    },
    (error) => {
      onError?.(error);
    }
  );
}

/**
 * Lists all mistake records across all tests for a user, ordered newest first.
 */
export async function listAllUserMistakes(
  uid: string
): Promise<MistakeRecord[]> {
  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(collection(db, "users", uid, "mistakes"));
  return sortMistakesDesc(snapshot.docs.map(mapMistakeDoc));
}

/**
 * Creates a mistake record and atomically increments the parent test's mistakeCount.
 */
export async function createMistakeRecord(
  uid: string,
  test: Pick<TestAttempt, "id" | "title">,
  values: MistakeFormValues
): Promise<MistakeRecord> {
  const db = requireDb();
  const mistakeRef = doc(getMistakesCollectionRef(uid));
  const testRef = doc(db, "users", uid, "tests", test.id);
  const now = new Date().toISOString();

  const questionNumber = normalizeOptionalQuestionNumber(values.questionNumber);
  const userAnswer = normalizeOptionalString(values.userAnswer);
  const correctAnswer = normalizeOptionalString(values.correctAnswer);
  const explanation = normalizeOptionalString(values.explanation);
  const extractedWord = normalizeOptionalString(values.extractedWord);

  const record: MistakeRecord = {
    id: mistakeRef.id,
    testId: test.id,
    testTitle: test.title,
    part: values.part as MistakeRecord["part"],
    ...(questionNumber !== undefined ? { questionNumber } : {}),
    errorCategory: values.errorCategory,
    promptSnippet: values.promptSnippet.trim(),
    ...(userAnswer ? { userAnswer } : {}),
    ...(correctAnswer ? { correctAnswer } : {}),
    ...(explanation ? { explanation } : {}),
    ...(extractedWord ? { extractedWord } : {}),
    createdAt: now,
  };

  const batch = writeBatch(db);
  batch.set(mistakeRef, record);
  batch.update(testRef, {
    mistakeCount: increment(1),
    updatedAt: now,
  });
  await batch.commit();

  return record;
}

export type MistakeUpdatePatch = Partial<MistakeFormValues> & {
  linkedVocabId?: string | null;
};

/**
 * Updates only the provided keys of a mistake record, deleting cleared optional fields.
 */
export async function updateMistakeRecord(
  uid: string,
  mistakeId: string,
  patch: MistakeUpdatePatch
): Promise<void> {
  const docRef = getMistakeDocRef(uid, mistakeId);
  const payload: Record<string, unknown | FieldValue> = {};

  if (patch.part !== undefined) {
    payload.part = patch.part;
  }
  if (patch.errorCategory !== undefined) {
    payload.errorCategory = patch.errorCategory;
  }
  if (patch.promptSnippet !== undefined) {
    payload.promptSnippet = patch.promptSnippet.trim();
  }

  if (Object.prototype.hasOwnProperty.call(patch, "questionNumber")) {
    const questionNumber = normalizeOptionalQuestionNumber(
      patch.questionNumber
    );
    payload.questionNumber =
      questionNumber !== undefined ? questionNumber : deleteField();
  }

  const optionalStringKeys = [
    "userAnswer",
    "correctAnswer",
    "explanation",
    "extractedWord",
    "linkedVocabId",
  ] as const;

  for (const key of optionalStringKeys) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const normalized = normalizeOptionalString(patch[key]);
      payload[key] = normalized ?? deleteField();
    }
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  await updateDoc(docRef, payload);
}

/**
 * Deletes a mistake record and atomically decrements the parent test's mistakeCount,
 * falling back to deleting only the mistake document if the parent test doc is missing.
 */
export async function deleteMistakeRecord(
  uid: string,
  testId: string,
  mistakeId: string
): Promise<void> {
  const db = requireDb();
  const mistakeRef = doc(db, "users", uid, "mistakes", mistakeId);
  const testRef = doc(db, "users", uid, "tests", testId);
  const now = new Date().toISOString();

  try {
    const batch = writeBatch(db);
    batch.delete(mistakeRef);
    batch.update(testRef, {
      mistakeCount: increment(-1),
      updatedAt: now,
    });
    await batch.commit();
  } catch {
    await deleteDoc(mistakeRef);
  }
}
