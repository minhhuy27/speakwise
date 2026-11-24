import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  estimateToeicScore,
  summarizePartScores,
} from "@/lib/engines/score-converter";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  TOEIC_PART_KEYS,
  type TestAttemptFormValues,
} from "@/lib/validations/test";
import type { PartScore, TestAttempt, ToeicPartKey } from "@/types/domain";

function requireDb() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error(
      "Firestore is not configured. Check your environment variables."
    );
  }
  return db;
}

function getTestsCollectionRef(uid: string) {
  return collection(requireDb(), "users", uid, "tests");
}

function getTestDocRef(uid: string, testId: string) {
  return doc(requireDb(), "users", uid, "tests", testId);
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

function sanitizeParts(
  parts: TestAttemptFormValues["parts"]
): Partial<Record<ToeicPartKey, PartScore>> {
  const cleaned: Partial<Record<ToeicPartKey, PartScore>> = {};

  for (const key of TOEIC_PART_KEYS) {
    const entry = parts[key];
    if (!entry) continue;
    cleaned[key] = {
      correct: Number(entry.correct),
      total: Number(entry.total),
    };
  }

  return cleaned;
}

function computeTestScores(
  values: TestAttemptFormValues,
  parts: Partial<Record<ToeicPartKey, PartScore>>
): {
  listeningCorrect: number;
  readingCorrect: number;
  listeningScore: number;
  readingScore: number;
  totalScore: number;
  isManualScoreOverride: boolean;
} {
  const { listeningCorrect, readingCorrect } = summarizePartScores(parts);

  if (values.mode === "mini_or_part") {
    return {
      listeningCorrect,
      readingCorrect,
      listeningScore: 0,
      readingScore: 0,
      totalScore: 0,
      isManualScoreOverride: false,
    };
  }

  const hasManualOverride =
    Boolean(values.isManualScoreOverride) &&
    typeof values.manualListeningScore === "number" &&
    Number.isFinite(values.manualListeningScore) &&
    typeof values.manualReadingScore === "number" &&
    Number.isFinite(values.manualReadingScore);

  if (hasManualOverride) {
    const listeningScore = values.manualListeningScore as number;
    const readingScore = values.manualReadingScore as number;
    return {
      listeningCorrect,
      readingCorrect,
      listeningScore,
      readingScore,
      totalScore: listeningScore + readingScore,
      isManualScoreOverride: true,
    };
  }

  const estimated = estimateToeicScore(listeningCorrect, readingCorrect);
  return {
    listeningCorrect,
    readingCorrect,
    listeningScore: estimated.listeningScore,
    readingScore: estimated.readingScore,
    totalScore: estimated.totalScore,
    isManualScoreOverride: false,
  };
}

function mapTestData(
  id: string,
  rawData: Omit<TestAttempt, "id"> & { id?: string }
): TestAttempt {
  return {
    ...rawData,
    id,
    parts: rawData.parts ?? {},
    mistakeCount:
      typeof rawData.mistakeCount === "number" ? rawData.mistakeCount : 0,
  };
}

function mapTestQueryDoc(snap: QueryDocumentSnapshot): TestAttempt {
  return mapTestData(
    snap.id,
    snap.data() as Omit<TestAttempt, "id"> & { id?: string }
  );
}

function sortTestsDesc(tests: TestAttempt[]): TestAttempt[] {
  return [...tests].sort((a, b) => {
    const takenCmp = b.takenAt.localeCompare(a.takenAt);
    if (takenCmp !== 0) {
      return takenCmp;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Lists all TOEIC test attempts for a user sorted by takenAt DESC, createdAt DESC.
 */
export async function listUserTests(uid: string): Promise<TestAttempt[]> {
  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(collection(db, "users", uid, "tests"));
  return sortTestsDesc(snapshot.docs.map(mapTestQueryDoc));
}

/**
 * Subscribes to real-time updates of a user's TOEIC test attempts sorted newest first.
 */
export function subscribeUserTests(
  uid: string,
  onNext: (tests: TestAttempt[]) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onNext([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, "users", uid, "tests"),
    (snapshot) => {
      onNext(sortTestsDesc(snapshot.docs.map(mapTestQueryDoc)));
    },
    (error) => {
      onError?.(error);
    }
  );
}

/**
 * Fetches a single TOEIC test attempt by ID.
 */
export async function getTestAttempt(
  uid: string,
  testId: string
): Promise<TestAttempt | null> {
  const db = getFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "users", uid, "tests", testId));
  if (!snapshot.exists()) {
    return null;
  }

  return mapTestData(
    snapshot.id,
    snapshot.data() as Omit<TestAttempt, "id"> & { id?: string }
  );
}

/**
 * Subscribes to real-time updates for a single TOEIC test attempt.
 */
export function subscribeTestAttempt(
  uid: string,
  testId: string,
  onNext: (test: TestAttempt | null) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onNext(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, "users", uid, "tests", testId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onNext(null);
        return;
      }
      onNext(
        mapTestData(
          snapshot.id,
          snapshot.data() as Omit<TestAttempt, "id"> & { id?: string }
        )
      );
    },
    (error) => {
      onError?.(error);
    }
  );
}

/**
 * Creates a new TOEIC test attempt document with computed part summaries and scaled scores.
 */
export async function createTestAttempt(
  uid: string,
  values: TestAttemptFormValues
): Promise<TestAttempt> {
  const docRef = doc(getTestsCollectionRef(uid));
  const now = new Date().toISOString();
  const cleanParts = sanitizeParts(values.parts);
  const scores = computeTestScores(values, cleanParts);
  const reflectionNote = normalizeOptionalString(values.reflectionNote);

  const attempt: TestAttempt = {
    id: docRef.id,
    mode: values.mode,
    title: values.title.trim(),
    source: values.source.trim(),
    takenAt: values.takenAt.trim(),
    durationMinutes: Number(values.durationMinutes),
    parts: cleanParts,
    listeningCorrect: scores.listeningCorrect,
    readingCorrect: scores.readingCorrect,
    listeningScore: scores.listeningScore,
    readingScore: scores.readingScore,
    totalScore: scores.totalScore,
    isManualScoreOverride: scores.isManualScoreOverride,
    ...(reflectionNote ? { reflectionNote } : {}),
    mistakeCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, attempt);
  return attempt;
}

/**
 * Updates an existing TOEIC test attempt and recomputes part summaries and scaled scores
 * while preserving the existing mistakeCount.
 */
export async function updateTestAttempt(
  uid: string,
  testId: string,
  values: TestAttemptFormValues
): Promise<void> {
  const docRef = getTestDocRef(uid, testId);
  const now = new Date().toISOString();
  const cleanParts = sanitizeParts(values.parts);
  const scores = computeTestScores(values, cleanParts);
  const reflectionNote = normalizeOptionalString(values.reflectionNote);

  await updateDoc(docRef, {
    mode: values.mode,
    title: values.title.trim(),
    source: values.source.trim(),
    takenAt: values.takenAt.trim(),
    durationMinutes: Number(values.durationMinutes),
    parts: cleanParts,
    listeningCorrect: scores.listeningCorrect,
    readingCorrect: scores.readingCorrect,
    listeningScore: scores.listeningScore,
    readingScore: scores.readingScore,
    totalScore: scores.totalScore,
    isManualScoreOverride: scores.isManualScoreOverride,
    reflectionNote: reflectionNote ?? deleteField(),
    updatedAt: now,
  });
}

/**
 * Deletes a TOEIC test attempt and all associated mistake records in a Firestore write batch.
 */
export async function deleteTestAttempt(
  uid: string,
  testId: string
): Promise<void> {
  const db = requireDb();
  const testRef = doc(db, "users", uid, "tests", testId);
  const mistakesQuery = query(
    collection(db, "users", uid, "mistakes"),
    where("testId", "==", testId)
  );
  const mistakesSnapshot = await getDocs(mistakesQuery);

  if (mistakesSnapshot.empty) {
    await deleteDoc(testRef);
    return;
  }

  const MAX_BATCH_OPS = 450;
  const mistakeDocs = mistakesSnapshot.docs;

  for (let i = 0; i < mistakeDocs.length; i += MAX_BATCH_OPS) {
    const batch = writeBatch(db);
    const chunk = mistakeDocs.slice(i, i + MAX_BATCH_OPS);
    for (const mistakeSnap of chunk) {
      batch.delete(mistakeSnap.ref);
    }
    if (i + MAX_BATCH_OPS >= mistakeDocs.length) {
      batch.delete(testRef);
    }
    await batch.commit();
  }
}
