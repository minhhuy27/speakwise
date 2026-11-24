import type { User } from "firebase/auth";
import {
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { UserProfileFormValues } from "@/lib/validations/profile";
import type { UserProfile } from "@/types/domain";

function getProfileDocRef(uid: string) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error(
      "Firestore is not configured. Check your environment variables."
    );
  }
  return doc(db, "users", uid);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as UserProfile;
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = getProfileDocRef(user.uid);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    return existing.data() as UserProfile;
  }

  const now = new Date().toISOString();
  const newProfile: UserProfile = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "TOEIC Learner",
    ...(user.photoURL ? { photoURL: user.photoURL } : {}),
    targetScore: 750,
    targetExamDate: null,
    dailyNewWordsLimit: 15,
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, newProfile);
  return newProfile;
}

export async function updateUserProfile(
  uid: string,
  values: UserProfileFormValues
): Promise<UserProfile> {
  const ref = getProfileDocRef(uid);
  const now = new Date().toISOString();

  await updateDoc(ref, {
    targetScore: values.targetScore,
    targetListening:
      values.targetListening === undefined || values.targetListening === null
        ? deleteField()
        : values.targetListening,
    targetReading:
      values.targetReading === undefined || values.targetReading === null
        ? deleteField()
        : values.targetReading,
    targetExamDate: values.targetExamDate ?? null,
    dailyNewWordsLimit: values.dailyNewWordsLimit,
    onboardingCompleted: true,
    updatedAt: now,
  });

  const updated = await getDoc(ref);
  return updated.data() as UserProfile;
}
