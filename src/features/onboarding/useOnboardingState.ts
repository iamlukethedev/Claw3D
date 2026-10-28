/**
 * useOnboardingState — Tracks whether onboarding has been completed.
 *
 * Uses localStorage so the wizard only shows once per browser.
 * The key is scoped to the Claw3D app to avoid collisions.
 */
import { useCallback } from "react";
import { useLocalStorageFlag } from "@/hooks/useLocalStorageFlag";

const STORAGE_KEY = "claw3d:onboarding:completed";

export type OnboardingStateReturn = {
  /** Whether the wizard should be shown. */
  showOnboarding: boolean;
  /** Mark onboarding as complete (hides the wizard). */
  completeOnboarding: () => void;
  /** Reset onboarding (shows the wizard again). */
  resetOnboarding: () => void;
};

export const useOnboardingState = (): OnboardingStateReturn => {
  // `null` until the browser value is known, so the wizard never flashes
  // during server render or hydration.
  const [completed, setCompleted] = useLocalStorageFlag(STORAGE_KEY);

  const completeOnboarding = useCallback(() => {
    setCompleted(true);
  }, [setCompleted]);

  const resetOnboarding = useCallback(() => {
    setCompleted(false);
  }, [setCompleted]);

  return {
    showOnboarding: completed === false,
    completeOnboarding,
    resetOnboarding,
  };
};
