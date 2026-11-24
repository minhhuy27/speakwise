import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  INITIAL_EASE_FACTOR,
  calculateNextSrsState,
} from "@/lib/engines/srs";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { VocabCardFormValues } from "@/lib/validations/vocab";
import type { SrsGrade, VocabCard } from "@/types/domain";

function requireDb() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error(
      "Firestore is not configured. Check your environment variables."
    );
  }
  return db;
}

function getVocabCollectionRef(uid: string) {
  return collection(requireDb(), "users", uid, "vocab");
}

function getVocabDocRef(uid: string, vocabId: string) {
  return doc(requireDb(), "users", uid, "vocab", vocabId);
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

function cleanStringList(items: string[] | undefined): string[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      cleaned.push(trimmed);
    }
  }
  return cleaned;
}

function mapVocabDoc(snap: QueryDocumentSnapshot): VocabCard {
  const data = snap.data() as Omit<VocabCard, "id"> & { id?: string };
  return {
    ...data,
    id: snap.id,
    wordFamily: Array.isArray(data.wordFamily) ? data.wordFamily : [],
    collocations: Array.isArray(data.collocations) ? data.collocations : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}

/**
 * Lists all vocabulary cards for a user ordered by newest created first.
 */
export async function listUserVocab(uid: string): Promise<VocabCard[]> {
  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const vocabQuery = query(
    collection(db, "users", uid, "vocab"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(vocabQuery);
  return snapshot.docs.map(mapVocabDoc);
}

/**
 * Subscribes to real-time updates of a user's vocabulary collection.
 */
export function subscribeUserVocab(
  uid: string,
  onNext: (cards: VocabCard[]) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onNext([]);
    return () => {};
  }

  const vocabQuery = query(
    collection(db, "users", uid, "vocab"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    vocabQuery,
    (snapshot) => {
      onNext(snapshot.docs.map(mapVocabDoc));
    },
    (error) => {
      onError?.(error);
    }
  );
}

/**
 * Creates a new vocabulary card initialized with SM-2 defaults.
 */
export async function createVocabCard(
  uid: string,
  values: VocabCardFormValues
): Promise<VocabCard> {
  const docRef = doc(getVocabCollectionRef(uid));
  const now = new Date().toISOString();
  const displayWord = values.displayWord.trim();
  const audioUrl = normalizeOptionalString(values.audioUrl);
  const personalNote = normalizeOptionalString(values.personalNote);
  const sourceTestId = normalizeOptionalString(values.sourceTestId);
  const sourceMistakeId = normalizeOptionalString(values.sourceMistakeId);

  const card: VocabCard = {
    id: docRef.id,
    word: displayWord.toLowerCase(),
    displayWord,
    ipa: values.ipa.trim(),
    partOfSpeech: values.partOfSpeech.trim(),
    meaningEn: values.meaningEn.trim(),
    meaningVi: values.meaningVi.trim(),
    exampleEn: values.exampleEn.trim(),
    exampleVi: values.exampleVi.trim(),
    ...(audioUrl ? { audioUrl } : {}),
    wordFamily: cleanStringList(values.wordFamily),
    collocations: cleanStringList(values.collocations),
    tags: cleanStringList(values.tags),
    ...(personalNote ? { personalNote } : {}),
    ...(sourceTestId ? { sourceTestId } : {}),
    ...(sourceMistakeId ? { sourceMistakeId } : {}),
    status: "new",
    easeFactor: INITIAL_EASE_FACTOR,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    nextReviewAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, card);
  return card;
}

/**
 * Updates lexical, bilingual, and metadata fields without resetting SM-2 review progress.
 */
export async function updateVocabCard(
  uid: string,
  vocabId: string,
  values: VocabCardFormValues
): Promise<void> {
  const docRef = getVocabDocRef(uid, vocabId);
  const now = new Date().toISOString();
  const displayWord = values.displayWord.trim();
  const audioUrl = normalizeOptionalString(values.audioUrl);
  const personalNote = normalizeOptionalString(values.personalNote);
  const sourceTestId = normalizeOptionalString(values.sourceTestId);
  const sourceMistakeId = normalizeOptionalString(values.sourceMistakeId);

  await updateDoc(docRef, {
    word: displayWord.toLowerCase(),
    displayWord,
    ipa: values.ipa.trim(),
    partOfSpeech: values.partOfSpeech.trim(),
    meaningEn: values.meaningEn.trim(),
    meaningVi: values.meaningVi.trim(),
    exampleEn: values.exampleEn.trim(),
    exampleVi: values.exampleVi.trim(),
    audioUrl: audioUrl ?? deleteField(),
    wordFamily: cleanStringList(values.wordFamily),
    collocations: cleanStringList(values.collocations),
    tags: cleanStringList(values.tags),
    personalNote: personalNote ?? deleteField(),
    sourceTestId: sourceTestId ?? deleteField(),
    sourceMistakeId: sourceMistakeId ?? deleteField(),
    updatedAt: now,
  });
}

/**
 * Deletes a vocabulary card document.
 */
export async function deleteVocabCard(
  uid: string,
  vocabId: string
): Promise<void> {
  await deleteDoc(getVocabDocRef(uid, vocabId));
}

/**
 * Computes and persists the next SM-2 SRS state after a flashcard review grade.
 */
export async function recordVocabReview(
  uid: string,
  card: VocabCard,
  grade: SrsGrade,
  now: Date = new Date()
): Promise<VocabCard> {
  const nextSrs = calculateNextSrsState(card, grade, now);
  const updatedAt = now.toISOString();

  await updateDoc(getVocabDocRef(uid, card.id), {
    status: nextSrs.status,
    easeFactor: nextSrs.easeFactor,
    intervalDays: nextSrs.intervalDays,
    repetitions: nextSrs.repetitions,
    lapses: nextSrs.lapses,
    nextReviewAt: nextSrs.nextReviewAt,
    lastReviewedAt: nextSrs.lastReviewedAt,
    updatedAt,
  });

  return {
    ...card,
    status: nextSrs.status,
    easeFactor: nextSrs.easeFactor,
    intervalDays: nextSrs.intervalDays,
    repetitions: nextSrs.repetitions,
    lapses: nextSrs.lapses,
    nextReviewAt: nextSrs.nextReviewAt,
    lastReviewedAt: nextSrs.lastReviewedAt,
    updatedAt,
  };
}
