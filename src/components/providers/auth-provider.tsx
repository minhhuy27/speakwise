"use client";

import * as React from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { signInWithGoogle, signOutUser } from "@/lib/firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { ensureUserProfile } from "@/lib/firebase/repositories/profile";
import type { UserProfile } from "@/types/domain";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState<boolean>(isFirebaseConfigured);

  React.useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!isActive) return;

      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(nextUser);

      try {
        const ensuredProfile = await ensureUserProfile(nextUser);
        if (isActive) {
          setProfile(ensuredProfile);
        }
      } catch (error) {
        console.error("Failed to ensure user profile:", error);
        if (isActive) {
          setProfile(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const signIn = React.useCallback(async () => {
    const credential = await signInWithGoogle();
    setUser(credential.user);
    try {
      const ensuredProfile = await ensureUserProfile(credential.user);
      setProfile(ensuredProfile);
    } catch (error) {
      console.error("Failed to load profile after sign-in:", error);
    }
  }, []);

  const signOut = React.useCallback(async () => {
    await signOutUser();
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = React.useCallback(async () => {
    if (!user) return;
    try {
      const latestProfile = await ensureUserProfile(user);
      setProfile(latestProfile);
    } catch (error) {
      console.error("Failed to refresh user profile:", error);
    }
  }, [user]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isConfigured: isFirebaseConfigured,
      signIn,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading, signIn, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
