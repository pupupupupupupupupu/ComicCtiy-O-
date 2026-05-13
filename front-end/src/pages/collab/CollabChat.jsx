import "./CollabChat.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import { useSocket } from "../../SocketContext";
import ComicLoader from "../../components/ComicLoader";

const API = process.env.REACT_APP_URL;

const ROLE_LABELS = {
  writer: "✍️ Writer", artist: "🎨 Artist", colorist: "🖌️ Colorist",
  letterer: "🔤 Letterer", editor: "📝 Editor", other: "💡 Other", owner: "👑 Owner",
};

const STATUS_CONFIG = {
  active:    { label: "Active",    color: "#28a060", icon: "🟢" },
  paused:    { label: "Paused",    color: "#f39c12", icon: "⏸️" },
  completed: { label: "Completed", color: "#7c6ef5", icon: "✅" },
  ended:     { label: "Ended",     color: "#e74c3c", icon: "🔴" },
};

/* ── Single message bubble ───────────────────────────────────────────────── */
const MessageBubble = ({ msg, myEmail }) => {
  const isMe     = msg.senderEmail === myEmail;
  const isSystem = msg.type === "system";
  const isSending = msg._optimistic;

  if (isSystem) {
    return (
      <div className="ccSysMsg">
        <span className="ccSysMsgIcon">⚙️</span>
        <span>{msg.content}</span>
      </div>
    );
  }

  return (
    <div className={`ccBubbleRow ${isMe ? "me" : "them"}`}>
      {!isMe && (
        <img
          src={msg.senderPic || ""}
          alt={msg.senderName}
          className="ccBubbleAvatar"
          onError={(e) => { e.target.style.display = "none"; }}
        />
      )}
      <div className={`ccBubble ${isMe ? "me" : "them"} ${isSending ? "sending" : ""}`}>
        {!isMe && <span className="ccBubbleSender">{msg.senderName || msg.senderEmail}</span>}
        {msg.type === "image" ? (
          <img src={msg.content} alt="shared" className="ccBubbleImg" />
        ) : (
          <p className="ccBubbleText">{msg.content}</p>
        )}
        <div className="ccBubbleMeta">
          <span className="ccBubbleTime">
            {new Date(msg.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
          {isMe && (
            <span className="ccBubbleTick" title={isSending ? "Sending…" : "Sent"}>
              {isSending ? "○" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Main CollabChat page ─────────────────────────────────────────────────── */
const CollabChat = () => {
  const { chatId }   = useParams();
  const navigate     = useNavigate();
  const { user, isAuthenticated, loginWithRedirect } = useAuth0();
  const { joinChat, leaveChat, sendTyping, sendStopTyping, on, off } = useSocket() || {};

  const [chat,       setChat]       = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [text,       setText]       = useState("");
  const [sending,    setSending]    = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [loadingMore,setLoadingMore]= useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const typingTimer = useRef(null);

  /* ── Fetch chat + messages ─────────────────────────────────────────────── */
  const fetchChat = useCallback(async (p = 1) => {
    try {
      const { data } = await axios.get(`${API}/api/collab/chat/${chatId}?page=${p}`);
      setChat(data.chat);
      setMessages(p === 1 ? data.messages : (prev) => [...data.messages, ...prev]);
      setPages(data.pagination.pages);
      setPage(p);
    } catch {
      // Chat not found or not a participant
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (isAuthenticated) fetchChat(1);
  }, [fetchChat, isAuthenticated]);

  /* ── Socket room ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!chatId || !joinChat) return;
    joinChat(chatId);
    return () => leaveChat(chatId);
  }, [chatId, joinChat, leaveChat]);

  /* ── Live message ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!on) return;
    const handler = (msg) => {
      setMessages((prev) => {
        // Already have the real message (e.g. from POST response)
        if (prev.some((m) => m._id === msg._id)) return prev;
        // Replace a matching optimistic bubble from the same sender
        const optIdx = prev.findIndex(
          (m) => m._optimistic && m.senderEmail === msg.senderEmail && m.content === msg.content
        );
        if (optIdx !== -1) {
          const updated = [...prev];
          updated[optIdx] = msg;
          return updated;
        }
        return [...prev, msg];
      });
      setPartnerTyping(false);
      if (user?.email && msg.senderEmail !== user.email) {
        axios.patch(`${API}/api/collab/chat/${chatId}/read`, { email: user.email }).catch(() => {});
      }
    };
    const cleanup = on("message_received", handler);
    return cleanup;
  }, [on, chatId, user?.email]);

  /* ── Typing indicators ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!on) return;
    const show = () => { setPartnerTyping(true); };
    const hide = () => { setPartnerTyping(false); };
    on("typing", show);
    on("stop_typing", hide);
    return () => { off?.("typing", show); off?.("stop_typing", hide); };
  }, [on, off]);

  /* ── Status/end events ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!on) return;
    const onStatus = ({ collabStatus }) =>
      setChat((c) => c ? { ...c, collabStatus } : c);
    const onEnded  = () =>
      setChat((c) => c ? { ...c, collabStatus: "ended" } : c);
    on("status_changed", onStatus);
    on("collab_ended",   onEnded);
    return () => { off?.("status_changed", onStatus); off?.("collab_ended", onEnded); };
  }, [on, off]);

  /* ── Scroll to bottom ──────────────────────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Mark read on mount ────────────────────────────────────────────────── */
  useEffect(() => {
    if (user?.email && chatId) {
      axios.patch(`${API}/api/collab/chat/${chatId}/read`, { email: user.email }).catch(() => {});
    }
  }, [chatId, user?.email]);

  /* ── Typing handler ────────────────────────────────────────────────────── */
  const handleTextChange = (e) => {
    setText(e.target.value);
    sendTyping?.(chatId, user?.name || user?.email);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => sendStopTyping?.(chatId), 2500);
  };

  /* ── Send message ──────────────────────────────────────────────────────── */
  /* ── Send message — optimistic update ─────────────────────────────────── */
  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;

    // 1. Clear input and show the bubble immediately
    setText("");
    setSending(true);
    sendStopTyping?.(chatId);
    clearTimeout(typingTimer.current);

    const optimisticId = `opt_${Date.now()}`;
    const optimisticMsg = {
      _id:         optimisticId,
      chatId,
      senderEmail: user.email,
      senderName:  user.name || user.email,
      senderPic:   user.picture || "",
      type:        "text",
      content,
      readBy:      [user.email],
      createdAt:   new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const { data: savedMsg } = await axios.post(`${API}/api/collab/chat/${chatId}/message`, {
        senderEmail: user.email,
        senderName:  user.name || user.email,
        senderPic:   user.picture || "",
        content,
        type: "text",
      });

      // 2. Swap optimistic for real; if socket already delivered it, just drop the optimistic
      setMessages((prev) => {
        const hasReal = prev.some((m) => m._id === savedMsg._id);
        if (hasReal) return prev.filter((m) => m._id !== optimisticId);
        return prev.map((m) => (m._id === optimisticId ? savedMsg : m));
      });
    } catch {
      // On error: remove optimistic bubble and restore the text
      setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
      setText(content);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ── Status update ─────────────────────────────────────────────────────── */
  const handleStatusChange = async (status) => {
    if (!user?.email) return;
    setActionLoading("status");
    try {
      await axios.patch(`${API}/api/collab/chat/${chatId}/status`, {
        email: user.email, collabStatus: status,
      });
    } catch {}
    setActionLoading("");
  };

  /* ── Mute toggle ───────────────────────────────────────────────────────── */
  const handleMute = async () => {
    if (!user?.email) return;
    setActionLoading("mute");
    try {
      const { data } = await axios.patch(`${API}/api/collab/chat/${chatId}/mute`, { email: user.email });
      setChat((c) => {
        if (!c) return c;
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.email === user.email ? { ...p, muted: data.muted } : p
          ),
        };
      });
    } catch {}
    setActionLoading("");
  };

  /* ── Block ─────────────────────────────────────────────────────────────── */
  const handleBlock = async () => {
    if (!user?.email || !partner) return;
    setActionLoading("block");
    try {
      await axios.post(`${API}/api/collab/chat/${chatId}/block`, {
        email: user.email, targetEmail: partner.email,
      });
      setConfirmBlock(false);
    } catch {}
    setActionLoading("");
  };

  /* ── Load older messages ───────────────────────────────────────────────── */
  const loadMore = async () => {
    if (page >= pages) return;
    setLoadingMore(true);
    await fetchChat(page + 1);
    setLoadingMore(false);
  };

  /* ── Guards ────────────────────────────────────────────────────────────── */
  if (!isAuthenticated) {
    return (
      <div className="ccGate">
        <h2>Sign in to view this collaboration</h2>
        <button className="btn btn-primary"
          onClick={() => loginWithRedirect({ appState: { returnTo: `/collab/${chatId}` } })}>
          Sign In
        </button>
      </div>
    );
  }

  if (loading) return <ComicLoader message="Opening the studio…" />;
  if (!chat)   return <div className="ccGate"><p>Chat not found or you don't have access.</p></div>;

  const me      = chat.participants.find((p) => p.email === user?.email);
  const partner = chat.participants.find((p) => p.email !== user?.email);
  const isMuted = me?.muted || false;
  const isActive = chat.collabStatus === "active";
  const statusConf = STATUS_CONFIG[chat.collabStatus] || STATUS_CONFIG.active;

  return (
    <div className="ccPage">

      {/* ── Mobile sidebar toggle ───────────────────────────────────────── */}
      <button className="ccMobileSidebarBtn" onClick={() => setShowSidebarMobile((v) => !v)}>
        {showSidebarMobile ? "✕ Close Info" : "ℹ️ Collab Info"}
      </button>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`ccSidebar ${showSidebarMobile ? "open" : ""}`}>
        {/* Comic info */}
        <div className="ccSideSection">
          <Link to={`/comics/${chat.comicId?._id}`} className="ccComicLink">
            <img src={chat.comicId?.coverImage?.url} alt={chat.comicId?.comicName} className="ccComicCover" />
            <div>
              <p className="ccSideLabel">Collaborating on</p>
              <h3 className="ccComicTitle">{chat.comicId?.comicName}</h3>
            </div>
          </Link>
        </div>

        {/* Partner info */}
        {partner && (
          <div className="ccSideSection">
            <p className="ccSideLabel">Your partner</p>
            <div className="ccPartnerRow">
              <img src={partner.pic || ""} alt={partner.name} className="ccPartnerAvatar"
                onError={(e) => { e.target.style.display = "none"; }} />
              <div>
                <p className="ccPartnerName">{partner.name || partner.email}</p>
                <p className="ccPartnerRole">{ROLE_LABELS[partner.role] || partner.role}</p>
              </div>
            </div>
          </div>
        )}

        {/* Your role */}
        {me && (
          <div className="ccSideSection">
            <p className="ccSideLabel">Your role</p>
            <span className="ccRoleBadge">{ROLE_LABELS[me.role] || me.role}</span>
          </div>
        )}

        {/* Chapter scope */}
        <div className="ccSideSection">
          <p className="ccSideLabel">Chapter scope</p>
          <p className="ccSideValue">
            {chat.chapterScope?.all
              ? "All chapters"
              : `Chapters: ${chat.chapterScope?.chapters?.join(", ") || "—"}`}
          </p>
        </div>

        {/* Status */}
        <div className="ccSideSection">
          <p className="ccSideLabel">Status</p>
          <span className="ccStatusBadge" style={{ background: statusConf.color }}>
            {statusConf.icon} {statusConf.label}
          </span>
        </div>

        {/* Status controls (only when active or paused) */}
        {(chat.collabStatus === "active" || chat.collabStatus === "paused") && (
          <div className="ccSideSection">
            <p className="ccSideLabel">Change status</p>
            <div className="ccStatusBtns">
              {chat.collabStatus === "active" && (
                <button className="ccSideBtn"
                  onClick={() => handleStatusChange("paused")}
                  disabled={actionLoading === "status"}>
                  ⏸ Pause
                </button>
              )}
              {chat.collabStatus === "paused" && (
                <button className="ccSideBtn green"
                  onClick={() => handleStatusChange("active")}
                  disabled={actionLoading === "status"}>
                  ▶ Resume
                </button>
              )}
              <button className="ccSideBtn purple"
                onClick={() => handleStatusChange("completed")}
                disabled={actionLoading === "status"}>
                ✅ Complete
              </button>
            </div>
          </div>
        )}

        {/* Mute / Block */}
        <div className="ccSideSection ccSideMod">
          <button className={`ccSideBtn ${isMuted ? "green" : ""}`}
            onClick={handleMute} disabled={actionLoading === "mute"}>
            {isMuted ? "🔔 Unmute" : "🔕 Mute"}
          </button>

          {chat.collabStatus !== "ended" && (
            <>
              {confirmBlock ? (
                <div className="ccBlockConfirm">
                  <p>Block and end this collaboration?</p>
                  <div className="ccBlockActions">
                    <button className="ccSideBtn red" onClick={handleBlock}
                      disabled={actionLoading === "block"}>
                      {actionLoading === "block" ? "…" : "Yes, block"}
                    </button>
                    <button className="ccSideBtn" onClick={() => setConfirmBlock(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="ccSideBtn red" onClick={() => setConfirmBlock(true)}>
                  🚫 Block & End
                </button>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <div className="ccPanel">
        {/* Header */}
        <div className="ccPanelHeader">
          <div className="ccHeaderLeft">
            <button className="ccBackBtn" onClick={() => navigate("/profile", { state: { tab: "collaborations" } })}>
              ← Back
            </button>
            <div>
              <h2 className="ccPanelTitle">{chat.comicId?.comicName}</h2>
              <p className="ccPanelSub">
                with {partner?.name || partner?.email || "your partner"} · {statusConf.icon} {statusConf.label}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="ccMessages">
          {page < pages && (
            <button className="ccLoadMore" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load earlier messages"}
            </button>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg._id} msg={msg} myEmail={user?.email} />
          ))}

          {partnerTyping && (
            <div className="ccTyping">
              <span /><span /><span />
              <p>{partner?.name || "Partner"} is typing…</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="ccInputRow">
          {!isActive ? (
            <p className="ccInputDisabled">
              {chat.collabStatus === "paused"
                ? "Chat is paused. Resume collaboration to send messages."
                : `Collaboration is ${chat.collabStatus}. Chat is read-only.`}
            </p>
          ) : (
            <>
              <textarea
                ref={inputRef}
                className="ccInput"
                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending}
              />
              <button
                className="ccSendBtn"
                onClick={handleSend}
                disabled={sending || !text.trim()}
                aria-label="Send"
              >
                {sending ? "…" : "➤"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollabChat;
