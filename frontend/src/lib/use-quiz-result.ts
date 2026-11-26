"use client";

import { useSyncExternalStore } from "react";
import type { QuizSubmitResponse } from "@/types/caix";

const RESULT_KEY_PREFIX = "caix_quiz_result_";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useStoredQuizResult(docId: string): {
  result: QuizSubmitResponse | null;
  hydrated: boolean;
} {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.sessionStorage.getItem(`${RESULT_KEY_PREFIX}${docId}`),
    () => "__SSR__"
  );

  if (raw === "__SSR__") {
    return { result: null, hydrated: false };
  }
  if (!raw) {
    return { result: null, hydrated: true };
  }
  try {
    return { result: JSON.parse(raw) as QuizSubmitResponse, hydrated: true };
  } catch {
    return { result: null, hydrated: true };
  }
}
