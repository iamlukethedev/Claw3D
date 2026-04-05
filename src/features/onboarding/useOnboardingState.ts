/**
 * useOnboardingState — Tracks whether onboarding has been completed.
 *
 * Uses localStorage so the wizard only shows once per browser.
 * The key is scoped to the Claw3D app to avoid collisions.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "claw3d:onboarding:completed";

const readCompleted = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const writeCompleted = (value: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage might be unavailable in some environments.
  }
};

export type OnboardingStateReturn = {
  /** Whether the wizard should be shown. */
  showOnboarding: boolean;
  /** Mark onboarding as complete (hides the wizard). */
  completeOnboarding: () => void;
  /** Reset onboarding (shows the wizard again). */
  resetOnboarding: () => void;
};

export const useOnboardingState = (): OnboardingStateReturn => {
  const [completed, setCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    setCompleted(readCompleted());
  }, []);

  const completeOnboarding = useCallback(() => {
    setCompleted(true);
    writeCompleted(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    setCompleted(false);
    writeCompleted(false);
  }, []);

  return {
    showOnboarding: completed === false,
    completeOnboarding,
    resetOnboarding,
  };
};
