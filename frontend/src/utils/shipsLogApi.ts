/*
 * Tiny event bus so any page can open the global Ship's Log dock
 * on a specific conversation or crew chat.
 *
 * Usage from any component:
 *   import { openCrewChat, openDmChat } from "../utils/shipsLogApi";
 *   openCrewChat(groupId);
 */

export const SHIPS_LOG_EVENT = "shipslog:open";

export interface OpenEventDetail {
  kind: "dm" | "crew";
  id: number;
}

export function openCrewChat(groupId: number) {
  window.dispatchEvent(
    new CustomEvent<OpenEventDetail>(SHIPS_LOG_EVENT, {
      detail: { kind: "crew", id: groupId },
    }),
  );
}

export function openDmChat(conversationId: number) {
  window.dispatchEvent(
    new CustomEvent<OpenEventDetail>(SHIPS_LOG_EVENT, {
      detail: { kind: "dm", id: conversationId },
    }),
  );
}
