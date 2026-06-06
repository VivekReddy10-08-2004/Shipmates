// Jacob Craig

import { useEffect, useRef, useState } from "react";
import {
  saveMatchProfile,
  fetchMatchSuggestions,
  fetchMatchProfile,
  uploadProfileImage,
  startConversation,
  fetchDirectMessages,
  sendDirectMessage,
  fetchInbox,
  fetchMessageRequests,
  respondToMessageRequest,
  fetchMatchingGroups,
  type Match,
  type Message,
  type MessageRequest,
  type MatchedGroup,
} from "../api/match.js";
import {
  searchCourses,
  fetchMyGroupInvites,
  respondToGroupInvite,
  joinGroup,
  type GroupInvite,
} from "../api/studygroups.js";
import { API_BASE } from "../api/base.js";
import { type Course, type College, type User } from "../hooks/useCurrentUser.js";
import { type Conversation } from "../api/match.js";
import DockTutorial, { type TourStep } from "../components/DockTutorial.js";
import { formatDateTime } from "../utils/dateFormat.js";

const DOCK_TOUR_KEY = "sb_dock_tour_done";

export default function StudyBuddyMatch() {
  // 🔐 Logged-in user
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Match profile
  const [profile, setProfile] = useState({
    study_style: "group",
    meeting_pref: "in_person",
    bio: "",
    profile_image_url: "",
    study_goal: "make friends",
    focus_time_pref: "evening",
    noise_pref: "background music",
    age: "",
  });

  const [selectedCourses, setSelectedCourses] = useState<College[]>([]);
  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState<Course[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  const [matches, setMatches] = useState<Match[]>([]);
  const [matchedGroups, setMatchedGroups] = useState<MatchedGroup[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [pendingJoinGroupIds, setPendingJoinGroupIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [hasProfile, setHasProfile] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // DM state
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null); // { conversation_id, partner, ... }
  const [dmMessages, setDmMessages] = useState<Message[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  const [showChatDock, setShowChatDock] = useState(false);
  const [inbox, setInbox] = useState<Conversation[]>([]); // conversations
  const [requests, setRequests] = useState<MessageRequest>([]); // message requests
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null); // profile popup

  // Guided tour state
  const [tourActive, setTourActive] = useState(false);
  const [tourSteps, setTourSteps] = useState<TourStep[]>([]);

  // Auto-scroll chat to bottom when messages change or conversation opens
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    // Scroll on next frame so the new message has been laid out
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [dmMessages, activeConversation?.conversation_id]);

  // ---------------------------
  // 1) Load logged-in user
  // ---------------------------
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch(`${API_BASE}/user/account`, {
          method: "GET",
          credentials: "include",
        });

        if (res.status === 401) {
          // Not logged in -> go to login page
          window.location.href = "/login";
          return;
        }

        const data = await res.json();
        if (data && !data.error) {
          setCurrentUser(data); // includes user_id
        } else {
          setError(data.error || "Failed to load account.");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load account.");
      } finally {
        setAuthLoading(false);
      }
    }

    loadUser();
  }, []);

  // ---------------------------
  // 2) Load match profile for this user
  // ---------------------------
  useEffect(() => {
    // Wait until we know who the user is
    if (!currentUser || !currentUser.user_id) return;

    async function init() {
      if (!currentUser) 
        return; // null check needed for quick fix - Rise
      try {
        const data = await fetchMatchProfile(currentUser.user_id);

        if (data && data.exists && data.profile) {
          const p = data.profile;

          setProfile((prev) => ({
            ...prev,
            study_style: p.study_style || "group",
            meeting_pref: p.meeting_pref || "in_person",
            bio: p.bio || "",
            profile_image_url: p.profile_image_url || "",
            study_goal: p.study_goal || "make friends",
            focus_time_pref: p.focus_time_pref || "evening",
            noise_pref: p.noise_pref || "background music",
            age: p.age ?? "",
          }));

          setSelectedCourses(data.courses || []);
          setHasProfile(true);
          setShowProfileForm(false); // existing users see matches first
          setInfo("Loaded your match profile.");

          await loadMatchesInternal(currentUser.user_id);
        } else {
          setHasProfile(false);
          setShowProfileForm(true);
        }
      } catch (err) {
        console.error(err);
        if (err instanceof Error) // added error check
          setError(err.message || "Failed to load profile");
      } finally {
        setInitialized(true);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Load inbox whenever the dock opens (and we have both profile + user)
  useEffect(() => {
    if (showChatDock && hasProfile && currentUser?.user_id) {
      loadInbox();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChatDock, hasProfile, currentUser]);

  function handleChange(e) {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleCourseSearch(q) {
    setCourseQuery(q);
    setError("");
    setInfo("");

    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setCourseResults([]);
      return;
    }

    try {
      const results = await searchCourses(trimmed, 8);
      setCourseResults(results);
    } catch (err) {
      if (err instanceof Error) // added error check - Rise
        setError(err.message || "Failed to search courses");
    }
  }

  function handleAddCourse(course) {
    if (selectedCourses.some((c) => c.course_id === course.course_id)) {
      setInfo("Course already added.");
      return;
    }

    if (selectedCourses.length >= 5) {
      setInfo("You can only choose up to 5 courses.");
      return;
    }

    setSelectedCourses((prev) => [...prev, course]);
    setCourseQuery("");
    setCourseResults([]);
  }

  function handleRemoveCourse(courseId) {
    setSelectedCourses((prev) =>
      prev.filter((c) => c.course_id !== courseId)
    );
  }

  async function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setInfo("");
    setIsUploading(true);

    try {
      const { url } = await uploadProfileImage(file);
      setProfile((prev) => ({
        ...prev,
        profile_image_url: url,
      }));
      setInfo("Profile image uploaded.");
    } catch (err) {
      console.error(err);
      if (err instanceof Error) // added check -Rise
        setError(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  }

  function formatTime(raw) {
    return formatDateTime(raw);
  }

  // ---------------------------
  // Open a conversation from inbox list
  // ---------------------------
  async function openConversationFromInbox(convo) {
    const userId = currentUser?.user_id;
    if (!userId) {
      setError("You must be logged in to view messages.");
      return;
    }

    setError("");
    setIsLoadingChat(true);

    try {
      const response = await fetchDirectMessages(convo.conversation_id, 50);
      const msgs = (await fetchDirectMessages(convo.conversation_id, 50)) as any[]; // extract array here

      const requestStatus = convo.request_status || "accepted";
      const isRequestFlow = requestStatus === "pending";
      const isYouRequester = convo.is_requester === 1;

      const youAlreadySent = msgs.some((m) => m.sender_user_id === userId);

      setActiveConversation({
        conversation_id: convo.conversation_id,
        partner: {
          other_user_id: convo.other_user_id,
          first_name: convo.first_name,
          last_name: convo.last_name,
        },
        requestStatus,
        isRequestFlow,
        isYouRequester,
        hasSentInitial: isRequestFlow && isYouRequester && youAlreadySent,
      });

      setDmMessages(msgs);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) setError(err.message || "Failed to load conversation.");
    } finally {
      setIsLoadingChat(false);
    }
  }


  // ---------------------------
  // Send DM in active conversation
  // ---------------------------
  async function handleSendDm(e) {
    e.preventDefault();
    const text = dmInput.trim();
    if (!text || !activeConversation) return;

    const userId = currentUser?.user_id;
    if (!userId) {
      setError("You must be logged in to send messages.");
      return;
    }

    const { isRequestFlow, hasSentInitial, isYouRequester } = activeConversation;

    // requester side: only one initial message while pending
    if (isRequestFlow && isYouRequester && hasSentInitial) {
      setInfo(
        `Waiting for ${activeConversation.partner.first_name} to accept your message request.`
      );
      return;
    }

    // target side: cannot send until they have accepted
    if (isRequestFlow && !isYouRequester) {
      setInfo("You need to accept this message request before replying.");
      return;
    }

    try {
      await sendDirectMessage(
        activeConversation.conversation_id,
        userId,
        text
      );

      const now = new Date().toISOString();
      setDmMessages((prev) => [
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
      setDmInput("");

      // mark that we've used our one message as requester
      setActiveConversation((prev) =>
        prev
          ? {
              ...prev,
              hasSentInitial:
                prev.isRequestFlow && prev.isYouRequester
                  ? true
                  : prev.hasSentInitial,
            }
          : prev
      );

      await loadInbox();
    } catch (err) {
      console.error(err);
      if (err instanceof Error)
        setError(err.message || "Failed to send message.");
    }
  }

  // ---------------------------
  // Save / update match profile
  // ---------------------------
  async function handleSaveProfile() {
    setError("");
    setInfo("");

    const userId = currentUser?.user_id;
    if (!userId) {
      setError("User is not logged in.");
      return;
    }

    if (selectedCourses.length === 0) {
      setError("Choose at least one course to match on.");
      return;
    }

    setIsSaving(true);
    try {
      const ageVal =
        profile.age === "" || profile.age === null
          ? null
          : Number(profile.age);

      const payload = {
        user_id: userId,
        study_style: profile.study_style || null,
        meeting_pref: profile.meeting_pref || null,
        bio: profile.bio || null,
        profile_image_url: profile.profile_image_url || null,
        study_goal: profile.study_goal || null,
        focus_time_pref: profile.focus_time_pref || null,
        noise_pref: profile.noise_pref || null,
        age: Number.isNaN(ageVal) ? null : ageVal,
        preferred_min_age: null,
        preferred_max_age: null,
        course_ids: selectedCourses.map((c) => c.course_id),
      };

      await saveMatchProfile(payload);
      setHasProfile(true);
      setInfo("Profile saved.");
      await loadMatchesInternal(userId);
    } catch (err) {
      console.error(err);
      if (err instanceof Error)
        setError(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------------------
  // Inbox and requests
  // ---------------------------
  async function loadInbox() {
    const userId = currentUser?.user_id;
    if (!userId) return;

    setIsLoadingInbox(true);
    setError("");
    try {
      const [convos, reqs] = await Promise.all([
        fetchInbox(userId),
        fetchMessageRequests(userId),
      ]);
      setInbox(convos || []);
      setRequests(reqs || []);
    } catch (err) {
      console.error(err);
      if (err instanceof Error)
        setError(err.message || "Failed to load chat.");
    } finally {
      setIsLoadingInbox(false);
    }
  }

  async function loadMatchesInternal(userIdParam?: number) { // changed it so the parameter is optional, since handleRefreshMatches() was complaining that parameters were missing - Rise
    const userId = userIdParam ?? currentUser?.user_id;
    if (!userId) return;

    setError("");
    setIsLoadingMatches(true);
    try {
      const data = await fetchMatchSuggestions(userId, 20);
      setMatches(data || []);
      if (!data || data.length === 0) {
        setInfo("No matches found yet.");
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error)
        setError(err.message || "Failed to load matches");
    } finally {
      setIsLoadingMatches(false);
    }

    // load compatible groups + pending invites in parallel; failures non-fatal
    try {
      const [groups, invites] = await Promise.all([
        fetchMatchingGroups(userId, 20),
        fetchMyGroupInvites(userId, 50),
      ]);
      setMatchedGroups(groups || []);
      setGroupInvites(invites || []);
    } catch (err) {
      console.error("Failed to load group matches/invites", err);
    }
  }

  async function handleRefreshMatches() {
    await loadMatchesInternal();
  }

  async function handleRequestJoinGroup(g: MatchedGroup) {
    const userId = currentUser?.user_id;
    if (!userId) return;
    try {
      await joinGroup(g.group_id, userId);
      setPendingJoinGroupIds((prev) => new Set(prev).add(g.group_id));
      setInfo(`Join request sent to ${g.group_name}.`);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) setError(err.message || "Failed to send join request");
    }
  }

  async function handleAcceptGroupInvite(invite: GroupInvite) {
    const userId = currentUser?.user_id;
    if (!userId) return;
    try {
      await respondToGroupInvite(invite.invite_id, "accept", userId);
      setGroupInvites((prev) => prev.filter((i) => i.invite_id !== invite.invite_id));
      setInfo(`You joined ${invite.group_name}!`);
      // remove from compatible-groups grid if present (now a member)
      setMatchedGroups((prev) => prev.filter((g) => g.group_id !== invite.group_id));
    } catch (err) {
      console.error(err);
      if (err instanceof Error) setError(err.message || "Failed to accept invite");
    }
  }

  async function handleDeclineGroupInvite(invite: GroupInvite) {
    const userId = currentUser?.user_id;
    if (!userId) return;
    try {
      await respondToGroupInvite(invite.invite_id, "reject", userId);
      setGroupInvites((prev) => prev.filter((i) => i.invite_id !== invite.invite_id));
    } catch (err) {
      console.error(err);
      if (err instanceof Error) setError(err.message || "Failed to decline invite");
    }
  }

  async function handleRespondToRequest(req, action) {
    const userId = currentUser?.user_id;
    if (!userId) {
      setError("You must be logged in to respond to requests.");
      return;
    }

    try {
      await respondToMessageRequest(req.request_id, action, userId);

      // Update active conversation if it matches this request
      setActiveConversation((prev) => {
        if (!prev) return prev;
        if (prev.partner.other_user_id !== req.requester_user_id) {
          return prev;
        }
        return {
          ...prev,
          requestStatus: action === "accept" ? "accepted" : "rejected",
          isRequestFlow: false,
          hasSentInitial: false,
        };
      });

      await loadInbox();
    } catch (err) {
      console.error(err);
      if (err instanceof Error)
        setError(err.message || "Failed to update request.");
    }
  }

  async function openChatWithMatch(match) {
    const userId = currentUser?.user_id;
    if (!userId) {
      setError("You must be logged in to start a chat.");
      return;
    }

    setError("");
    setInfo("");
    setIsLoadingChat(true);
    try {
      const { conversation_id } = await startConversation(
        userId,
        match.other_user_id
      );

      await loadInbox();
      const msgs = await fetchDirectMessages(conversation_id, 50);

      const alreadySent = (msgs || []).some(
        (m) => m.sender_user_id === userId
      );

      setActiveConversation({
        conversation_id,
        partner: match,
        isRequestFlow: true,
        hasSentInitial: alreadySent,
        isYouRequester: true,
        requestStatus: "pending",
      });
      setDmMessages(msgs || []);
      setShowChatDock(true);
    } catch (err) {
      console.error(err);
      if (err instanceof Error)
        setError(err.message || "Failed to open chat.");
    } finally {
      setIsLoadingChat(false);
    }
  }

  function truncatePreview(text, max = 60) {
    if (!text) return "";
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  // ----- request / input gating helpers -----
  const isPendingRequest =
    !!activeConversation && activeConversation.requestStatus === "pending";

  const isRejectedRequest =
    !!activeConversation && activeConversation.requestStatus === "rejected";

  const isYouRequester =
    isPendingRequest && activeConversation?.isYouRequester === true;

  const isYouTarget =
    isPendingRequest && activeConversation?.isYouRequester === false;

  const disableDmInput =
    (isYouRequester && activeConversation?.hasSentInitial) ||
    isYouTarget ||
    isRejectedRequest;

  const dmPlaceholder = isRejectedRequest
    ? "This message request was ignored."
    : isPendingRequest
    ? isYouRequester
      ? `Waiting for ${activeConversation.partner.first_name} to accept...`
      : "You need to accept this message request before replying."
    : "Type a message...";

  // 🔍 DEBUG LOGS — TEMPORARY
  useEffect(() => {
    console.log("ACTIVE CONVERSATION STATE", activeConversation);
  }, [activeConversation]);

  useEffect(() => {
    console.log("DISABLE DM INPUT?", disableDmInput);
  }, [disableDmInput]);

  // Auto-launch tour for first-time users (no profile + haven't done the tour).
  // Must live BEFORE any early return so React sees the same hook count every render.
  useEffect(() => {
    if (!initialized) return;
    if (hasProfile) return;
    let done = false;
    try {
      done = window.localStorage.getItem(DOCK_TOUR_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (!done) {
      const t = setTimeout(() => {
        setShowProfileForm(true);
        setTourSteps([
          {
            title: "Welcome Ashore, Matey!",
            body:
              "The Dock is where you find your study partner. Let me show you how it works in 4 quick steps.",
            icon: "⚓",
          },
          {
            target: '[data-tour="manifest-title"]',
            placement: "bottom",
            icon: "📜",
            title: "1. Fill out your profile",
            body:
              "Tell other students how you study, when you're free, and what courses you're in. This helps us match you.",
          },
          {
            target: '[data-tour="manifest-courses"]',
            placement: "bottom",
            icon: "📚",
            title: "2. Add your courses",
            body:
              "Pick up to 5 courses. We only match you with people who share at least one class. That's the magic.",
          },
          {
            target: '[data-tour="manifest-save"]',
            placement: "bottom",
            icon: "💾",
            title: "3. Save your profile",
            body:
              "When you're ready, hit Save Profile. We'll find compatible classmates and show them below.",
          },
          {
            title: "4. Send a Crew Request",
            body:
              "Once matches appear, click \"Send Crew Request\" on anyone interesting. If they accept, you can chat and plan study sessions together!",
            icon: "💬",
          },
        ]);
        setTourActive(true);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [initialized, hasProfile]);

  // While we’re figuring out who the user is, show a soft loading state
  if (authLoading) {
    return (
      <div className="app-shell home-page">
        <p className="group-meta">Loading your account…</p>
      </div>
    );
  }

  // ---------------------------
  // Derived state for match buttons
  // ---------------------------
  // Map of other_user_id -> conversation info (if we already have one)
  const conversationByUser = new Map<number, any>();
  for (const c of inbox) {
    const otherId = c?.partner?.other_user_id ?? c?.other_user_id;
    if (otherId != null) conversationByUser.set(otherId, c);
  }
  // Set of user_ids who have sent ME a pending request
  const incomingRequestByUser = new Map<number, any>();
  for (const r of requests as any[]) {
    const rid = r?.requester_user_id;
    if (rid != null) incomingRequestByUser.set(rid, r);
  }

  type MatchStatus = "none" | "sent" | "accepted" | "incoming";

  function statusForMatch(m: any): MatchStatus {
    const convo = conversationByUser.get(m.other_user_id);
    if (convo) {
      const status = convo.request_status || "accepted";
      if (status === "accepted") return "accepted";
      if (status === "pending") return "sent";
    }
    if (incomingRequestByUser.has(m.other_user_id)) return "incoming";
    return "none";
  }

  async function handleSendCrewRequest(match: any) {
    const userId = currentUser?.user_id;
    if (!userId) return;
    setError("");
    setInfo("");
    try {
      await startConversation(userId, match.other_user_id);
      setInfo(`Crew request sent to ${match.first_name}!`);
      await loadInbox();
    } catch (err) {
      console.error(err);
      if (err instanceof Error)
        setError(err.message || "Failed to send request.");
    }
  }

  async function handleOpenChatWithMatch(match: any) {
    const userId = currentUser?.user_id;
    if (!userId) return;
    const convo = conversationByUser.get(match.other_user_id);
    if (!convo) {
      // fallback — shouldn't happen if status === accepted
      await handleSendCrewRequest(match);
      return;
    }
    setShowChatDock(true);
    await openConversationFromInbox(convo);
  }

  async function handleAcceptIncomingRequest(match: any) {
    const req = incomingRequestByUser.get(match.other_user_id);
    if (!req) return;
    await handleRespondToRequest(req, "accept");
  }

  function initialsFromName(first?: string, last?: string) {
    const f = (first || "").trim().charAt(0).toUpperCase();
    const l = (last || "").trim().charAt(0).toUpperCase();
    return (f + l) || "?";
  }

  /** Start the first-time guided tour for users without a profile. */
  function startNewUserTour() {
    setShowProfileForm(true); // ensure the form is visible during the tour
    setTourSteps([
      {
        title: "Welcome Ashore, Matey!",
        body:
          "The Dock is where you find your study partner. Let me show you how it works in 4 quick steps.",
        icon: "⚓",
      },
      {
        target: '[data-tour="manifest-title"]',
        placement: "bottom",
        icon: "📜",
        title: "1. Fill out your profile",
        body:
          "Tell other students how you study, when you're free, and what courses you're in. This helps us match you.",
      },
      {
        target: '[data-tour="manifest-courses"]',
        placement: "left",
        icon: "📚",
        title: "2. Add your courses",
        body:
          "Pick up to 5 courses. We only match you with people who share at least one class. That's the magic.",
      },
      {
        target: '[data-tour="manifest-save"]',
        placement: "top",
        icon: "💾",
        title: "3. Save your profile",
        body:
          "When you're ready, hit Save Profile. We'll find compatible classmates and show them below.",
      },
      {
        title: "4. Send a Crew Request",
        body:
          "Once matches appear, click \"Send Crew Request\" on anyone interesting. If they accept, you can chat and plan study sessions together!",
        icon: "💬",
      },
    ]);
    setTourActive(true);
  }

  function closeTour() {
    setTourActive(false);
    try {
      window.localStorage.setItem(DOCK_TOUR_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="dock-page home-page">
      {/* Hero — wooden dock sign hanging from ropes */}
      <div className="dock-hero">
        <div className="dock-hero-ropes" aria-hidden="true" />
        <div>
          <h1 className="dock-hero-title">The Dock</h1>
        </div>
        <div className="dock-hero-actions">
          {hasProfile && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowProfileForm((v) => !v)}
              >
                {showProfileForm ? "Hide Settings" : "Dock Settings"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleRefreshMatches}
                disabled={isLoadingMatches}
              >
                {isLoadingMatches ? "Searching..." : "Refresh mateys"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Small "re-run tour" prompt for users without a profile (after they dismiss the auto tour) */}
      {!hasProfile && initialized && !tourActive && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "0.85rem 1.2rem",
            marginBottom: "1rem",
            border: "1px solid rgba(212, 168, 67, 0.3)",
            borderRadius: "0.65rem",
            background: "rgba(26, 138, 125, 0.08)",
          }}
        >
          <div>
            <strong style={{ color: "var(--gold)" }}>New to The Dock?</strong>
            <p style={{ margin: "0.15rem 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
              Take the quick tour and we'll walk you through setting up your profile.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={startNewUserTour}
            style={{ flexShrink: 0 }}
          >
            ⚓ Start Tour
          </button>
        </div>
      )}

      {/* Guided tour overlay */}
      <DockTutorial
        active={tourActive}
        steps={tourSteps}
        onClose={closeTour}
      />

      {/* ============== PROFILE MANIFEST ============== */}
      {showProfileForm && (
        <section className="section">
          <div className="manifest-card">
            <h2 className="manifest-title" data-tour="manifest-title">Captain's Manifest</h2>
            <p className="manifest-sub">
              Tell your fellow mateys how you like to study, when you're free,
              and which courses you're taking. We'll suggest compatible
              shipmates from your college first.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
                gap: "1.5rem",
              }}
            >
              {/* Left column */}
              <div>
                <div className="manifest-field">
                  <label className="manifest-label">Study Style</label>
                  <select
                    name="study_style"
                    value={profile.study_style}
                    onChange={handleChange}
                    className="manifest-select"
                  >
                    <option value="solo">Solo (I work alone)</option>
                    <option value="pair">Pair (I like a study buddy)</option>
                    <option value="group">Group (bring the whole crew)</option>
                  </select>
                </div>

                <div className="manifest-field">
                  <label className="manifest-label">Meeting Preference</label>
                  <select
                    name="meeting_pref"
                    value={profile.meeting_pref}
                    onChange={handleChange}
                    className="manifest-select"
                  >
                    <option value="online">Online</option>
                    <option value="in_person">In-person</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div className="manifest-field">
                  <label className="manifest-label">Study Goal</label>
                  <select
                    name="study_goal"
                    value={profile.study_goal}
                    onChange={handleChange}
                    className="manifest-select"
                  >
                    <option value="make friends">Make friends</option>
                    <option value="ace tests">Ace tests</option>
                    <option value="review material">Review material</option>
                    <option value="all of the above">All of the above</option>
                  </select>
                </div>

                <div className="manifest-field">
                  <label className="manifest-label">Focus Time</label>
                  <select
                    name="focus_time_pref"
                    value={profile.focus_time_pref}
                    onChange={handleChange}
                    className="manifest-select"
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="night">Late night</option>
                    <option value="no preference">No preference</option>
                  </select>
                </div>

                <div className="manifest-field">
                  <label className="manifest-label">Noise Preference</label>
                  <select
                    name="noise_pref"
                    value={profile.noise_pref}
                    onChange={handleChange}
                    className="manifest-select"
                  >
                    <option value="silent">Silent</option>
                    <option value="some noise">Some chatter</option>
                    <option value="background music">Background music OK</option>
                    <option value="no preference">No preference</option>
                  </select>
                </div>

                <div className="manifest-field">
                  <label className="manifest-label">Your Age (optional)</label>
                  <input
                    type="number"
                    name="age"
                    min="17"
                    max="80"
                    value={profile.age}
                    onChange={handleChange}
                    placeholder="e.g. 20"
                    className="manifest-input"
                  />
                </div>

                <div className="manifest-field">
                  <label className="manifest-label">Portrait</label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.9rem",
                      marginTop: "0.3rem",
                    }}
                  >
                    {profile.profile_image_url ? (
                      <img
                        src={profile.profile_image_url}
                        alt="Portrait"
                        style={{
                          width: "64px",
                          height: "64px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "3px solid #d4a843",
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="crewmate-avatar crewmate-avatar-placeholder"
                        style={{ width: 64, height: 64 }}
                      >
                        ?
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                      style={{ color: "#2a1808" }}
                    />
                    {isUploading && (
                      <span className="manifest-course-name">Uploading...</span>
                    )}
                  </div>
                </div>

                <div className="manifest-field">
                  <label className="manifest-label">Your Story (Bio)</label>
                  <textarea
                    name="bio"
                    value={profile.bio}
                    onChange={handleChange}
                    placeholder="A few words about yourself, what you're studying for, what you hope to find..."
                    className="manifest-textarea"
                  />
                </div>
              </div>

              {/* Right column — courses */}
              <div>
                <div className="manifest-field">
                  <label className="manifest-label" data-tour="manifest-courses">Your Courses</label>
                  <p className="manifest-course-name" style={{ marginBottom: "0.5rem" }}>
                    Pick up to 5. We only match mateys who share at least one course with you.
                  </p>
                  <input
                    type="text"
                    placeholder="Search courses (e.g., COS 420)"
                    value={courseQuery}
                    onChange={(e) => handleCourseSearch(e.target.value)}
                    className="manifest-input"
                  />
                </div>

                {courseResults.length > 0 && (
                  <div className="manifest-courses">
                    {courseResults.map((c) => (
                      <div key={c.course_id} className="manifest-course-row">
                        <div>
                          <span className="manifest-course-code">
                            {c.course_code}
                          </span>
                          <span className="manifest-course-name">
                            {c.course_name}
                            {c.college_name ? ` · ${c.college_name}` : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="manifest-save"
                          style={{ padding: "0.3rem 0.8rem", fontSize: "0.75rem" }}
                          onClick={() => handleAddCourse(c)}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="manifest-courses" style={{ marginTop: "0.75rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <strong style={{ color: "#2a1808" }}>
                      Selected ({selectedCourses.length}/5)
                    </strong>
                  </div>

                  {selectedCourses.length === 0 ? (
                    <p className="manifest-course-name">
                      No courses selected yet. Search above to add some.
                    </p>
                  ) : (
                    selectedCourses.map((c) => (
                      <div key={c.course_id} className="manifest-course-row">
                        <div>
                          <span className="manifest-course-code">
                            {c.course_code}
                          </span>
                          <span className="manifest-course-name">
                            {c.course_name}
                          </span>
                        </div>
                        <button
                          type="button"
                          style={{
                            padding: "0.3rem 0.8rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "#2a1808",
                            background: "rgba(139, 37, 0, 0.12)",
                            border: "1.5px solid rgba(139, 37, 0, 0.45)",
                            borderRadius: "0.4rem",
                            cursor: "pointer",
                          }}
                          onClick={() => handleRemoveCourse(c.course_id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: "1.25rem" }}>
                  <button
                    type="button"
                    className="manifest-save"
                    data-tour="manifest-save"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Profile"}
                  </button>
                </div>

                {error && (
                  <p
                    style={{
                      color: "#8b2500",
                      marginTop: "0.6rem",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                    }}
                  >
                    {error}
                  </p>
                )}
                {info && !error && (
                  <p
                    style={{
                      color: "#0e6b60",
                      marginTop: "0.6rem",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                    }}
                  >
                    {info}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============== SUGGESTED CREWMATES ============== */}
      {hasProfile && !showProfileForm && (
        <section className="section">
          <h2 className="dock-section-title">Suggested Mateys</h2>
          <p className="dock-section-sub">
            Compatible shipmates from your college. Tap a portrait to learn more.
          </p>

          {matches.length === 0 ? (
            <div className="dock-empty">
              <p style={{ margin: 0, fontSize: "1rem", marginBottom: "0.5rem" }}>
                No mateys in sight yet.
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                {initialized
                  ? "Try refreshing, or add more courses to your manifest to broaden your voyage."
                  : "Loading..."}
              </p>
            </div>
          ) : (
            <div className="crewmate-grid">
              {matches.map((m) => {
                const status = statusForMatch(m);
                return (
                  <div key={m.other_user_id} className="crewmate-card">
                    <div className="crewmate-card-top">
                      <div className="crewmate-info">
                        <button
                          type="button"
                          className="crewmate-name"
                          onClick={() => setSelectedMatch(m)}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                          }}
                        >
                          {m.first_name} {m.last_name}
                        </button>
                      </div>
                    </div>

                    <div className="crewmate-actions">
                      {status === "none" && (
                        <button
                          type="button"
                          className="crewmate-btn crewmate-btn-primary"
                          onClick={() => handleSendCrewRequest(m)}
                        >
                          Send Friend Request
                        </button>
                      )}
                      {status === "sent" && (
                        <button
                          type="button"
                          className="crewmate-btn crewmate-btn-ghost"
                          disabled
                        >
                          Request Sent
                        </button>
                      )}
                      {status === "incoming" && (
                        <button
                          type="button"
                          className="crewmate-btn crewmate-btn-primary"
                          onClick={() => handleAcceptIncomingRequest(m)}
                        >
                          Accept Request
                        </button>
                      )}
                      {status === "accepted" && (
                        <button
                          type="button"
                          className="crewmate-btn crewmate-btn-primary"
                          onClick={() => handleOpenChatWithMatch(m)}
                        >
                          Open Chat
                        </button>
                      )}
                      <button
                        type="button"
                        className="crewmate-btn crewmate-btn-ghost"
                        onClick={() => setSelectedMatch(m)}
                        style={{ flex: "0 0 auto" }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ============== INCOMING GROUP INVITES ============== */}
      {hasProfile && !showProfileForm && groupInvites.length > 0 && (
        <section className="section">
          <h2 className="dock-section-title">Crew Invitations</h2>
          <p className="dock-section-sub">
            Crews that have invited you to set sail with them.
          </p>
          <div className="crewmate-grid">
            {groupInvites.map((inv) => (
              <div key={inv.invite_id} className="crewmate-card">
                <div className="crewmate-card-top">
                  <div className="crewmate-info">
                    <div className="crewmate-name" style={{ fontWeight: 600 }}>
                      {inv.group_name}
                    </div>
                    <p className="crewmate-meta">
                      {inv.course_code ? `${inv.course_code} · ` : ""}
                      {inv.member_count}/{inv.max_members} aboard
                    </p>
                    <p className="crewmate-meta" style={{ fontSize: "0.78rem" }}>
                      Invited by {inv.invited_by_name}
                    </p>
                  </div>
                </div>
                <div className="crewmate-actions">
                  <button
                    type="button"
                    className="crewmate-btn crewmate-btn-primary"
                    onClick={() => handleAcceptGroupInvite(inv)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="crewmate-btn crewmate-btn-ghost"
                    onClick={() => handleDeclineGroupInvite(inv)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============== COMPATIBLE CREWS ============== */}
      {hasProfile && !showProfileForm && (
        <section className="section">
          <h2 className="dock-section-title">Compatible Crews</h2>
          <p className="dock-section-sub">
            Study groups that share your courses and study style.
          </p>

          {matchedGroups.length === 0 ? (
            <div className="dock-empty">
              <p style={{ margin: 0, fontSize: "1rem", marginBottom: "0.5rem" }}>
                No crews on the horizon yet.
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                Add more courses to your manifest, or check back as new crews are formed.
              </p>
            </div>
          ) : (
            <div className="crewmate-grid">
              {matchedGroups.map((g) => {
                const alreadyRequested = pendingJoinGroupIds.has(g.group_id);
                return (
                  <div key={g.group_id} className="crewmate-card">
                    <div className="crewmate-card-top">
                      <div className="crewmate-info">
                        <div className="crewmate-name" style={{ fontWeight: 600 }}>
                          {g.group_name}
                        </div>
                        <p className="crewmate-meta">
                          {g.course_code ? `${g.course_code} · ` : ""}
                          {g.member_count}/{g.max_members} aboard
                        </p>
                        <p className="crewmate-meta" style={{ fontSize: "0.78rem" }}>
                          Captained by {g.owner_name}
                        </p>
                      </div>
                    </div>
                    <div className="crewmate-actions">
                      {alreadyRequested ? (
                        <button
                          type="button"
                          className="crewmate-btn crewmate-btn-ghost"
                          disabled
                        >
                          Request Sent
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="crewmate-btn crewmate-btn-primary"
                          onClick={() => handleRequestJoinGroup(g)}
                        >
                          Request to Join
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Ship's Log chat is now mounted globally via GlobalShipsLog */}

      {/* ============== MATCH PROFILE POPUP ============== */}
      {selectedMatch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 22, 40, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: "1rem",
          }}
          onClick={() => setSelectedMatch(null)}
        >
          <div
            className="crewmate-card"
            style={{
              width: "500px",
              maxWidth: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "1.5rem 1.75rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "0.75rem",
                marginBottom: "1rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                {selectedMatch.profile_image_url ? (
                  <img
                    src={selectedMatch.profile_image_url}
                    alt={`${selectedMatch.first_name} ${selectedMatch.last_name}`}
                    className="crewmate-avatar"
                    style={{ width: 80, height: 80 }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="crewmate-avatar crewmate-avatar-placeholder"
                    style={{ width: 80, height: 80, fontSize: "1.6rem" }}
                  >
                    {initialsFromName(
                      selectedMatch.first_name,
                      selectedMatch.last_name,
                    )}
                  </div>
                )}
                <div>
                  <h3
                    className="manifest-title"
                    style={{ fontSize: "1.25rem", margin: 0 }}
                  >
                    {selectedMatch.first_name} {selectedMatch.last_name}
                  </h3>
                  <p className="crewmate-meta">
                    {selectedMatch.age ? `Age ${selectedMatch.age} · ` : ""}
                    {(selectedMatch.shared_courses ?? 0)} shared course
                    {selectedMatch.shared_courses === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="crewmate-btn crewmate-btn-ghost"
                onClick={() => setSelectedMatch(null)}
              >
                ✕
              </button>
            </div>

            <div
              className="crewmate-traits"
              style={{ marginBottom: "0.85rem" }}
            >
              {selectedMatch.study_style && (
                <span className="crewmate-trait">
                  {selectedMatch.study_style}
                </span>
              )}
              {selectedMatch.meeting_pref && (
                <span className="crewmate-trait">
                  {selectedMatch.meeting_pref === "in_person"
                    ? "in-person"
                    : selectedMatch.meeting_pref}
                </span>
              )}
              {selectedMatch.study_goal && (
                <span className="crewmate-trait">
                  {selectedMatch.study_goal}
                </span>
              )}
              {selectedMatch.focus_time_pref && (
                <span className="crewmate-trait">
                  {selectedMatch.focus_time_pref}
                </span>
              )}
              {selectedMatch.noise_pref && (
                <span className="crewmate-trait">
                  {selectedMatch.noise_pref}
                </span>
              )}
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <strong style={{ color: "#2a1808" }}>Bio</strong>
              <p
                className="crewmate-bio"
                style={{ marginTop: "0.35rem" }}
              >
                {selectedMatch.bio && selectedMatch.bio.trim().length > 0
                  ? selectedMatch.bio
                  : "This matey hasn't written a tale yet."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
