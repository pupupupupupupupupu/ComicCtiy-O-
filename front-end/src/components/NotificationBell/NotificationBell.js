import "./NotificationBell.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useSocket } from "../../SocketContext";
import axios from "axios";

const API = process.env.REACT_APP_URL;

const typeIcon = {
  collab_request:  "🤝",
  collab_accepted: "✅",
  collab_declined: "❌",
  collab_cancelled:"↩️",
  reply:           "💬",
  follow:          "👁",
};

const NotificationBell = () => {
  const { user }     = useAuth0();
  const navigate     = useNavigate();
  const { on, off }  = useSocket() || {};
  const dropRef      = useRef(null);

  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread,        setUnread]        = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);

  const fetchNotifs = useCallback(async (p = 1) => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/notifications/${encodeURIComponent(user.email)}?page=${p}`);
      setNotifications(p === 1 ? res.data.notifications : (prev) => [...prev, ...res.data.notifications]);
      setUnread(res.data.unread);
      setPages(res.data.pagination.pages);
      setPage(p);
    } catch {}
    setLoading(false);
  }, [user?.email]);

  // Initial load of badge count
  useEffect(() => {
    if (!user?.email) return;
    axios.get(`${API}/api/notifications/${encodeURIComponent(user.email)}/unread`)
      .then((r) => setUnread(r.data.count))
      .catch(() => {});
  }, [user?.email]);

  // Real-time push
  useEffect(() => {
    if (!on) return;
    const handler = ({ unreadCount }) => setUnread(unreadCount);
    const cleanup = on("notification", handler);
    return cleanup;
  }, [on]);

  // Open dropdown → load notifications
  const handleOpen = async () => {
    setOpen((o) => !o);
    if (!open) await fetchNotifs(1);
  };

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    try {
      await axios.patch(`${API}/api/notifications/${encodeURIComponent(user.email)}/read-all`);
      setNotifications((n) => n.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch {}
  };

  const handleNotifClick = async (notif) => {
    // Mark single as read
    if (!notif.read) {
      axios.patch(`${API}/api/notifications/${notif._id}/read`).catch(() => {});
      setNotifications((n) => n.map((x) => x._id === notif._id ? { ...x, read: true } : x));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);

    // Navigate to the right place
    const { type, meta } = notif;
    if ((type === "collab_accepted") && meta?.chatId) {
      navigate(`/collab/${meta.chatId}`);
    } else if ((type === "collab_request" || type === "collab_declined") && meta?.comicId) {
      navigate("/profile", { state: { tab: "notifications" } });
    } else if (meta?.comicId) {
      navigate(`/comics/${meta.comicId}`);
    }
  };

  if (!user) return null;

  return (
    <div className="nbWrap" ref={dropRef}>
      <button className="nbBtn" onClick={handleOpen} aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="nbBadge">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="nbDropdown">
          <div className="nbHeader">
            <span className="nbTitle">Notifications</span>
            {unread > 0 && (
              <button className="nbMarkAll" onClick={markAllRead}>Mark all read</button>
            )}
          </div>

          {loading && notifications.length === 0 ? (
            <div className="nbEmpty">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="nbEmpty">You're all caught up 🎉</div>
          ) : (
            <>
              <div className="nbList">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    className={`nbItem ${n.read ? "read" : "unread"}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <span className="nbItemIcon">{typeIcon[n.type] || "🔔"}</span>
                    <div className="nbItemBody">
                      {n.meta?.coverUrl && (
                        <img src={n.meta.coverUrl} alt="" className="nbItemThumb" />
                      )}
                      <div className="nbItemText">
                        <p className="nbItemMsg">{n.message}</p>
                        <span className="nbItemTime">
                          {new Date(n.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    {!n.read && <span className="nbDot" />}
                  </div>
                ))}
              </div>
              {page < pages && (
                <button className="nbLoadMore" onClick={() => fetchNotifs(page + 1)} disabled={loading}>
                  {loading ? "Loading…" : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
