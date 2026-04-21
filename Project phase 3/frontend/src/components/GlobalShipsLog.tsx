/*
 * GlobalShipsLog — floating, persistent chat dock that appears on every
 * authed page. Shows:
 *   - Direct Messages (1:1) — matey conversations
 *   - Crews — study-group chats
 *   - Requests — pending friend requests
 *
 * Notification badge counts: unread incoming DM conversations + pending
 * requests + unread group messages. Clears on open / read.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../api/base.js";
import {
  fetchInbox,
  fetchMessageRequests,
  fetchDirectMessages,
  sendDirectMessage,
  respondToMessageRequest,
  type Conversation,
  type Message,
  type MessageRequest,
} from "../api/match.js";
import {
  fetchMyGroups,
  type Group,
} from "../api/studygroups.js";
import {
  getChatMessages,
  sendChatMessage,
} from "../api/chat.js";
import { formatDateTime } from "../utils/dateFormat.js";
import { SHIPS_LOG_EVENT, type OpenEventDetail } from "../utils/shipsLogApi.js";

type TabKey = "dm" | "crew" | "req";

const POLL_MS = 5000;           // refresh inbox/groups/requests every 5s
const ACTIVE_CHAT_POLL_MS = 3000; // refresh the open chat every 3s

function lastReadKey(kind: "dm" | "crew", id: number | string) {
  return `sb_log_last_read_${kind}_${id}`;
}

function getLastRead(kind: "dm" | "crew", id: number | string): number {
  try {
    const v = window.localStorage.getItem(lastReadKey(kind, id));
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function setLastRead(kind: "dm" | "crew", id: number | string, ts: number) {
  try {
    window.localStorage.setItem(lastReadKey(kind, id), String(ts));
  } catch {
    /* ignore */
  }
}

function capBadge(n: number): string {
  return n > 99 ? "99+" : String(n);
}

function initials(first?: string, last?: string) {
  const f = (first || "").trim().charAt(0).toUpperCase();
  const l = (last || "").trim().charAt(0).toUpperCase();
  return (f + l) || "?";
}

type ActiveChat =
  | { kind: "dm"; convo: Conversation }
  | { kind: "crew"; group: Group }
  | null;

export default function GlobalShipsLog() {
  // --- Auth: only mount the dock for logged-in users ---
  const [userId, setUserId] = useState<number | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/user/account`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const u = data?.user || data;
          setUserId(u?.user_id ?? null);
        }
      } catch {
        /* anon — dock won't render */
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- UI state ---
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("dm");
  const [inbox, setInbox] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<MessageRequest>([] as any);
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState<ActiveChat>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const SEED_KEY = "sb_log_seeded_v1";

  // --- Initial + polling load ---
  async function refreshAll() {
    if (!userId) return;
    try {
      const [ib, rq, gs] = await Promise.all([
        fetchInbox(userId),
        fetchMessageRequests(userId),
        fetchMyGroups(userId),
      ]);

      // One-time migration: if this browser has never used the Ship's Log before,
      // seed last_read for existing convos/crews to their current last_sent_at so
      // the badge doesn't light up for pre-existing history. Done exactly ONCE
      // per browser; subsequent page refreshes must NOT re-seed or fresh messages
      // would get silently marked as read.
      const seededAlready = (() => {
        try { return window.localStorage.getItem(SEED_KEY) === "1"; }
        catch { return false; }
      })();

      if (!seededAlready) {
        for (const c of (ib || []) as any[]) {
          const raw = c.last_sent_at ?? c.last_message_at;
          if (raw) {
            const ts = new Date(raw).getTime();
            if (ts) setLastRead("dm", c.conversation_id, ts);
          }
        }
        for (const g of (gs || []) as any[]) {
          const raw = g.last_sent_at;
          if (raw) {
            const ts = new Date(raw).getTime();
            if (ts) setLastRead("crew", g.group_id, ts);
          }
        }
        try { window.localStorage.setItem(SEED_KEY, "1"); } catch { /* ignore */ }
      }

      setInbox(ib || []);
      setRequests((rq as any) || []);
      setGroups(gs || []);
    } catch {
      /* best-effort */
    }
  }

  useEffect(() => {
    if (!userId) return;
    refreshAll();
    const t = setInterval(refreshAll, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // --- Listen for external "open chat" events dispatched from other pages
  //     (e.g. the Chat button on the Study Groups page). --------------------
  useEffect(() => {
    if (!userId) return;
    async function handler(e: Event) {
      const detail = (e as CustomEvent<OpenEventDetail>).detail;
      if (!detail) return;

      // Ensure inbox/groups are loaded, then open the matching chat.
      await refreshAll();
      setOpen(true);
      setTab(detail.kind === "crew" ? "crew" : "dm");

      // Use setTimeout so state updates for refreshAll flush first.
      setTimeout(async () => {
        if (detail.kind === "crew") {
          const g = (await fetchMyGroups(userId)).find(
            (x: Group) => x.group_id === detail.id,
          );
          if (g) openCrew(g);
        } else {
          const ib = await fetchInbox(userId);
          const c = (ib || []).find(
            (x: Conversation) => x.conversation_id === detail.id,
          );
          if (c) openDm(c);
        }
      }, 50);
    }
    window.addEventListener(SHIPS_LOG_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(SHIPS_LOG_EVENT, handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // --- Notification count ---
  // The SQL procedure returns `last_sent_at` (not `last_message_at`) and doesn't
  // expose who sent the last message. So we treat a convo as unread if its latest
  // activity timestamp is newer than our locally-stored "last read" for that
  // conversation. We bump last_read when the user opens the convo, AND also when
  // they send a message (so their own sends don't count as unread).
  const unreadDmCount = useMemo(() => {
    let n = 0;
    for (const c of inbox as any[]) {
      const raw = c.last_sent_at ?? c.last_message_at;
      if (!raw) continue;
      const lastTs = new Date(raw).getTime();
      if (!lastTs) continue;
      const lastRead = getLastRead("dm", c.conversation_id);
      if (lastTs > lastRead) n++;
    }
    return n;
  }, [inbox]);

  // Unread crews — backend now returns `last_sent_at` on /groups/mine
  const unreadCrewCount = useMemo(() => {
    let n = 0;
    for (const g of groups as any[]) {
      const raw = g.last_sent_at;
      if (!raw) continue;
      const lastTs = new Date(raw).getTime();
      if (!lastTs) continue;
      const lastRead = getLastRead("crew", g.group_id);
      if (lastTs > lastRead) n++;
    }
    return n;
  }, [groups]);

  const requestsCount = (requests as any[])?.length ?? 0;

  const totalBadge = unreadDmCount + unreadCrewCount + requestsCount;

  // --- Poll the currently-open chat for new messages (real-time-ish) ---
  useEffect(() => {
    if (!active || !userId) return;

    async function pull() {
      try {
        let latest: any[] | null = null;
        if (active!.kind === "dm") {
          latest = (await fetchDirectMessages(
            active!.convo.conversation_id,
            50,
          )) as any[];
        } else {
          latest = await getChatMessages(active!.group.group_id, 50);
        }
        if (!latest) return;
        const sorted = sortAscByTime(latest);
        setMessages((prev) => {
          // Cheap change-detection to avoid unnecessary re-renders / scroll jumps.
          if (
            prev.length === sorted.length &&
            prev[prev.length - 1]?.message_id === sorted[sorted.length - 1]?.message_id
          ) {
            return prev;
          }
          // Mark read since the chat is open
          if (active!.kind === "dm") {
            setLastRead("dm", active!.convo.conversation_id, Date.now() + 1000);
          } else {
            setLastRead("crew", active!.group.group_id, Date.now() + 1000);
          }
          return sorted;
        });
      } catch {
        /* ignore */
      }
    }
    const t = setInterval(pull, ACTIVE_CHAT_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId]);

  // --- Chat scroll-to-bottom when messages change ---
  // Run on multiple frames to handle late layout from images/fonts.
  useEffect(() => {
    const scroller = chatScrollRef.current;
    if (!scroller) return;
    function forceBottom() {
      if (!scroller) return;
      scroller.scrollTop = scroller.scrollHeight;
      chatBottomRef.current?.scrollIntoView({ block: "end" });
    }
    requestAnimationFrame(forceBottom);
    const t1 = setTimeout(forceBottom, 60);
    const t2 = setTimeout(forceBottom, 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [messages, active]);

  /** Always sort messages oldest → newest so the most recent sits at the bottom,
   *  regardless of whether the server returns them ASC or DESC. */
  function sortAscByTime(msgs: any[]): any[] {
    return (msgs || []).slice().sort((a, b) => {
      const ta = new Date(a.sent_time || 0).getTime() || 0;
      const tb = new Date(b.sent_time || 0).getTime() || 0;
      if (ta !== tb) return ta - tb;
      // Tie-break by message_id (DB ids are monotonic)
      const ia = Number(a.message_id) || 0;
      const ib = Number(b.message_id) || 0;
      return ia - ib;
    });
  }

  // --- Open a DM conversation ---
  async function openDm(convo: Conversation) {
    if (!userId) return;
    setActive({ kind: "dm", convo });
    setLoading(true);
    try {
      const msgs = (await fetchDirectMessages(convo.conversation_id, 50)) as any[];
      setMessages(sortAscByTime(msgs));
      // Mark read with a timestamp ≥ latest message so unread clears immediately
      setLastRead("dm", convo.conversation_id, Date.now() + 1000);
      // Also refresh inbox so the sidebar unread dot/badge updates right away
      refreshAll();
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  // --- Open a group (crew) chat ---
  async function openCrew(group: Group) {
    if (!userId) return;
    setActive({ kind: "crew", group });
    setLoading(true);
    try {
      const msgs = await getChatMessages(group.group_id, 50);
      setMessages(sortAscByTime(msgs));
      setLastRead("crew", group.group_id, Date.now() + 1000);
      refreshAll();
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  // --- Send message in active chat ---
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !active || !userId) return;

    try {
      if (active.kind === "dm") {
        await sendDirectMessage(active.convo.conversation_id, userId, text);
        const now = new Date().toISOString();
        setMessages((prev) => [
          ...prev,
          {
            message_id: `local-${Date.now()}`,
            sender_user_id: userId,
            first_name: "You",
            last_name: "",
            content: text,
            sent_time: now,
          },
        ]);
        // Bump own last_read so our just-sent message doesn't mark as unread
        setLastRead("dm", active.convo.conversation_id, Date.now() + 1000);
      } else if (active.kind === "crew") {
        await sendChatMessage(active.group.group_id, userId, text);
        const now = new Date().toISOString();
        setMessages((prev) => [
          ...prev,
          {
            message_id: `local-${Date.now()}`,
            user_id: userId,
            first_name: "You",
            last_name: "",
            content: text,
            sent_time: now,
          },
        ]);
        setLastRead("crew", active.group.group_id, Date.now() + 1000);
      }
      setInput("");
      refreshAll();
    } catch {
      /* non-fatal */
    }
  }

  async function handleRequest(r: any, action: "accept" | "reject") {
    if (!userId) return;
    try {
      await respondToMessageRequest(r.request_id, action, userId);
      refreshAll();
    } catch {
      /* non-fatal */
    }
  }

  function handleOpen() {
    setOpen(true);
    // When opening, refresh so badge/inbox are fresh
    refreshAll();
  }

  function handleClose() {
    setOpen(false);
    setActive(null);
    setMessages([]);
  }

  if (!authChecked || !userId) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="chat-float-btn"
          onClick={handleOpen}
          aria-label="Open Ship's Log"
        >
          💬 Ship's Log
          {totalBadge > 0 && (
            <span
              style={{
                marginLeft: "0.4rem",
                background: "#8b2500",
                color: "white",
                borderRadius: "999px",
                padding: "0 0.45rem",
                fontSize: "0.72rem",
                fontWeight: 800,
                minWidth: "1.4rem",
                textAlign: "center",
              }}
            >
              {capBadge(totalBadge)}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="chat-dock">
          <div className="chat-dock-header">
            <div className="chat-dock-title">
              ⚓ Ship's Log
              {totalBadge > 0 && (
                <span
                  style={{
                    marginLeft: "0.5rem",
                    background: "#8b2500",
                    color: "white",
                    borderRadius: "999px",
                    padding: "0 0.5rem",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    minWidth: "1.4rem",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1.4,
                  }}
                >
                  {capBadge(totalBadge)}
                </span>
              )}
            </div>
            <button
              type="button"
              className="chat-close-btn"
              onClick={handleClose}
            >
              Hide
            </button>
          </div>

          <div className="chat-dock-body">
            {/* LEFT SIDEBAR with tabs */}
            <div className="chat-sidebar">
              <div className="chat-tabs">
                <button
                  type="button"
                  className={`chat-tab${tab === "dm" ? " active" : ""}`}
                  onClick={() => setTab("dm")}
                >
                  Mateys
                </button>
                <button
                  type="button"
                  className={`chat-tab${tab === "crew" ? " active" : ""}`}
                  onClick={() => setTab("crew")}
                >
                  Crews
                </button>
                <button
                  type="button"
                  className={`chat-tab${tab === "req" ? " active" : ""}`}
                  onClick={() => setTab("req")}
                >
                  Requests
                </button>
              </div>

              <div className="chat-sidebar-list">
                {tab === "dm" && (
                  inbox.length === 0 ? (
                    <p className="chat-empty-side">No conversations yet.</p>
                  ) : (
                    inbox.map((c: any) => {
                      const isActive =
                        active?.kind === "dm" &&
                        active.convo.conversation_id === c.conversation_id;
                      const raw = c.last_sent_at ?? c.last_message_at;
                      const lastTs = raw ? new Date(raw).getTime() : 0;
                      const isUnread =
                        !isActive &&
                        lastTs > getLastRead("dm", c.conversation_id);
                      const name = `${c.partner?.first_name ?? c.first_name ?? "Unknown"} ${c.partner?.last_name ?? c.last_name ?? ""}`;
                      return (
                        <div
                          key={c.conversation_id}
                          className={`chat-convo-item${isActive ? " active" : ""}${isUnread ? " unread" : ""}`}
                          onClick={() => openDm(c)}
                        >
                          <span className="chat-convo-name">
                            {name}
                            {isUnread && <span className="chat-convo-dot" />}
                          </span>
                          <span className="chat-convo-preview">
                            {c.last_message
                              ? c.last_message.length > 42
                                ? c.last_message.slice(0, 41) + "…"
                                : c.last_message
                              : "No messages yet"}
                          </span>
                        </div>
                      );
                    })
                  )
                )}

                {tab === "crew" && (
                  groups.length === 0 ? (
                    <p className="chat-empty-side">No crews yet.</p>
                  ) : (
                    groups.map((g: any) => {
                      const isActive =
                        active?.kind === "crew" &&
                        active.group.group_id === g.group_id;
                      const raw = g.last_sent_at;
                      const lastTs = raw ? new Date(raw).getTime() : 0;
                      const isUnread =
                        !isActive &&
                        lastTs > getLastRead("crew", g.group_id);
                      return (
                        <div
                          key={g.group_id}
                          className={`chat-convo-item${isActive ? " active" : ""}${isUnread ? " unread" : ""}`}
                          onClick={() => openCrew(g)}
                        >
                          <span className="chat-convo-name">
                            {g.group_name}
                            {isUnread && <span className="chat-convo-dot" />}
                          </span>
                          <span className="chat-convo-preview">
                            {g.role ? `Role: ${g.role}` : ""}
                          </span>
                        </div>
                      );
                    })
                  )
                )}

                {tab === "req" && (
                  (requests as any[]).length === 0 ? (
                    <p className="chat-empty-side">No pending requests.</p>
                  ) : (
                    (requests as any[]).map((r) => (
                      <div key={r.request_id} className="chat-request-item">
                        <p className="chat-request-name">
                          {r.requester_name ||
                            `${r.first_name} ${r.last_name || ""}`}
                        </p>
                        <p className="chat-request-sub">
                          wants to be your matey
                        </p>
                        <div className="chat-request-actions">
                          <button
                            type="button"
                            className="chat-request-btn accept"
                            onClick={() => handleRequest(r, "accept")}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="chat-request-btn reject"
                            onClick={() => handleRequest(r, "reject")}
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>

            {/* MAIN CHAT AREA */}
            <div className="chat-main">
              {!active ? (
                <div className="chat-empty-main">
                  {tab === "req"
                    ? "Review your friend requests on the left."
                    : tab === "crew"
                    ? "Pick a crew to open its chat."
                    : "Pick a conversation to start chatting."}
                </div>
              ) : (
                <>
                  <div className="chat-main-header">
                    {active.kind === "dm" ? (
                      <>
                        <div className="chat-main-avatar">
                          {initials(
                            active.convo.partner?.first_name ??
                              active.convo.first_name,
                            active.convo.partner?.last_name ??
                              active.convo.last_name,
                          )}
                        </div>
                        <div className="chat-main-name">
                          {active.convo.partner?.first_name ??
                            active.convo.first_name}{" "}
                          {active.convo.partner?.last_name ??
                            active.convo.last_name}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="chat-main-avatar">⚓</div>
                        <div className="chat-main-name">
                          {active.group.group_name}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="chat-messages" ref={chatScrollRef}>
                    {loading ? (
                      <div className="chat-empty-main">Loading…</div>
                    ) : messages.length === 0 ? (
                      <div className="chat-empty-main">
                        No messages yet. Say ahoy! 🌊
                      </div>
                    ) : (
                      messages.map((m: Message | any) => {
                        const senderId =
                          m.sender_user_id ?? m.user_id;
                        const isMe = senderId === userId;
                        return (
                          <div
                            key={m.message_id}
                            className={`chat-message ${isMe ? "me" : "them"}`}
                          >
                            <div
                              className={`chat-bubble ${isMe ? "me" : "them"}`}
                            >
                              {!isMe && (
                                <div className="chat-bubble-sender">
                                  {m.first_name || `User ${senderId}`}{" "}
                                  {m.last_name || ""}
                                </div>
                              )}
                              <div>{m.content}</div>
                              <span className="chat-bubble-time">
                                {formatDateTime(m.sent_time)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <form onSubmit={handleSend} className="chat-input-row">
                    <textarea
                      className="chat-input"
                      placeholder="Type a message..."
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      }}
                    />
                    <button
                      type="submit"
                      className="chat-send-btn"
                      disabled={!input.trim()}
                    >
                      Send
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
