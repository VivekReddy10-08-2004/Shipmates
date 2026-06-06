/*
 * Tiny event bus for cross-component "reload your list" signals.
 *   Generator page fires: fireReload("quizzes") after approve.
 *   List component listens:  useReloadListener("quizzes", load).
 */

export type ReloadChannel = "quizzes" | "flashcards";

const EVENT_NAME = "sb-reload";

export function fireReload(channel: ReloadChannel) {
  window.dispatchEvent(
    new CustomEvent<ReloadChannel>(EVENT_NAME, { detail: channel }),
  );
}

/** Hook: invoke `onReload` whenever a reload event for the given channel fires. */
import { useEffect } from "react";

export function useReloadListener(
  channel: ReloadChannel,
  onReload: () => void,
) {
  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent<ReloadChannel>;
      if (ce.detail === channel) onReload();
    }
    window.addEventListener(EVENT_NAME, handler as EventListener);
    return () =>
      window.removeEventListener(EVENT_NAME, handler as EventListener);
  }, [channel, onReload]);
}
