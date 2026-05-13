import "./selectedComic.css";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import ComicLoader from "../../components/ComicLoader";
import LikeBookmark from "../../components/LikeBookmark/LikeBookmark";
import AddChapterModal from "../../components/AddChapterModal/AddChapterModal";
import Comments from "../../components/Comments/Comments";
import CollabRequestModal from "../../components/CollabRequestModal/CollabRequestModal";

const BASE_URL = `${process.env.REACT_APP_URL}/api/comics`;
const HISTORY_KEY = (comicId) => `cc_history_${comicId}`;

const saveLocalHistory = (comicId, entry) => {
  try { localStorage.setItem(HISTORY_KEY(comicId), JSON.stringify(entry)); } catch {}
};
const getLocalHistory = (comicId) => {
  try { const r = localStorage.getItem(HISTORY_KEY(comicId)); return r ? JSON.parse(r) : null; }
  catch { return null; }
};

const Toast = ({ msg, type }) =>
  msg ? <div className={`toast toast-${type}`}>{msg}</div> : null;

/* ── Chapter row ──────────────────────────────────────────────────────────── */
const ChapterRow = ({ chapter, comicId, isLast, onRead }) => {
  const navigate = useNavigate();
  const handleRead = () => {
    onRead(chapter);
    if (chapter.isOriginal) navigate(`/comics/${comicId}/read`);
    else navigate(`/comics/${comicId}/read/${chapter._id}`);
  };
  return (
    <div className={`chapterRow ${isLast ? "latest" : ""}`} onClick={handleRead}>
      <div className="chapterBadge">Ch.{chapter.chapterNumber}</div>
      <div className="chapterInfo">
        <span className="chapterTitle">
          {chapter.title || `Chapter ${chapter.chapterNumber}`}
          {isLast && <span className="latestTag">LATEST</span>}
        </span>
        {chapter.createdAt && (
          <span className="chapterDate">
            {new Date(chapter.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </span>
        )}
      </div>
      <span className="chapterReadBtn">Read →</span>
    </div>
  );
};

/* ── Last Visited banner ──────────────────────────────────────────────────── */
const LastVisited = ({ visit, comicId }) => {
  const navigate = useNavigate();
  if (!visit) return null;
  const handleContinue = () => {
    if (visit.chapterId) navigate(`/comics/${comicId}/read/${visit.chapterId}`);
    else navigate(`/comics/${comicId}/read`);
  };
  return (
    <div className="lastVisitedBanner" onClick={handleContinue}>
      <div className="lastVisitedIcon">📖</div>
      <div className="lastVisitedInfo">
        <span className="lastVisitedLabel">Continue Reading</span>
        <span className="lastVisitedChapter">Chapter {visit.chapterNumber}</span>
      </div>
      <span className="lastVisitedCta">→</span>
    </div>
  );
};

/* ── Main page ────────────────────────────────────────────────────────────── */
const SelectedComic = () => {
  const { id }      = useParams();
  const location    = useLocation();
  const navigate    = useNavigate();
  const { user }    = useAuth0();

  const [comic,        setComic]        = useState(location.state || null);
  const [chapters,     setChapters]     = useState([]);
  const [loading,      setLoading]      = useState(!location.state);
  const [error,        setError]        = useState(null);
  const [activeTab,    setActiveTab]    = useState("chapters");
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastVisit,    setLastVisit]    = useState(null);
  const [toast,        setToast]        = useState({ msg: "", type: "success" });

  // ── Collab state ──────────────────────────────────────────────────────────
  const [showCollabModal,  setShowCollabModal]  = useState(false);
  const [collabReqStatus,  setCollabReqStatus]  = useState(null); // null|'pending'|'accepted'|'no_chat'
  const [myCollabChatId,   setMyCollabChatId]   = useState(null);
  const [togglingCollab,   setTogglingCollab]   = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3200);
  };

  const fetchData = useCallback(async () => {
    try {
      const [comicRes, chaptersRes] = await Promise.all([
        axios.get(`${BASE_URL}/${id}`),
        axios.get(`${BASE_URL}/${id}/chapters`),
      ]);
      setComic(comicRes.data);
      setChapters(chaptersRes.data || []);
    } catch {
      setError("Comic not found.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Check user's collab request status for this comic
  useEffect(() => {
    if (!user?.email || !id) return;
    axios.get(`${process.env.REACT_APP_URL}/api/collab/requests/${encodeURIComponent(user.email)}`)
      .then(({ data }) => {
        // Check sent requests for this comic
        const mine = data.sent?.find((r) => String(r.comicId?._id || r.comicId) === id);
        if (!mine) return;
        if (mine.status === "accepted") {
          setCollabReqStatus("accepted");
          // Find the chat
          axios.get(`${process.env.REACT_APP_URL}/api/collab/chats/${encodeURIComponent(user.email)}`)
            .then(({ data: chats }) => {
              const chat = chats.find((c) => String(c.comicId?._id || c.comicId) === id);
              if (chat) setMyCollabChatId(chat._id);
            }).catch(() => {});
        } else if (mine.status === "pending") {
          setCollabReqStatus("pending");
        }
      }).catch(() => {});
  }, [user?.email, id]);

  const handleCollabToggle = async () => {
    if (!user || !comic) return;
    setTogglingCollab(true);
    try {
      const { data } = await axios.patch(
        `${process.env.REACT_APP_URL}/api/comics/${id}/collab-toggle`,
        { email: user.email }
      );
      setComic((prev) => ({ ...prev, collabOpen: data.collabOpen }));
      showToast(data.collabOpen ? "Comic is now open for collaboration 🤝" : "Collaboration requests closed.", "success");
    } catch {
      showToast("Toggle failed. Try again.", "error");
    }
    setTogglingCollab(false);
  };

  const handleCollabSent = () => {
    setShowCollabModal(false);
    setCollabReqStatus("pending");
    showToast("Collaboration request sent! The creator will be notified. 🎉", "success");
  };

  // IP-based view tracking
  useEffect(() => {
    axios.patch(`${BASE_URL}/${id}/view`).catch(() => {});
  }, [id]);

  // Load last visited from localStorage
  useEffect(() => {
    const stored = getLocalHistory(id);
    if (stored) setLastVisit(stored);
  }, [id]);

  // Full ordered chapter list: original first, extras sorted by number
  const allChapters = comic
    ? [
        { _id: null, isOriginal: true, chapterNumber: comic.chapterNumber,
          title: comic.comicName, createdAt: comic.createdAt },
        ...chapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
      ]
    : [];

  const handleChapterRead = useCallback((chapter) => {
    const entry = {
      chapterNumber: chapter.chapterNumber,
      chapterId:     chapter.isOriginal ? null : chapter._id,
      visitedAt:     new Date().toISOString(),
    };
    saveLocalHistory(id, entry);
    setLastVisit(entry);
    if (user) {
      axios.post(`${process.env.REACT_APP_URL}/api/history`, {
        userId: user.sub, comicId: id,
        comicName: comic?.comicName, coverUrl: comic?.coverImage?.url,
        chapterNumber: chapter.chapterNumber,
        chapterId: chapter.isOriginal ? null : chapter._id,
      }).catch(() => {});
    }
  }, [id, user, comic]);

  const handleChapterAdded = useCallback((newChapter) => {
    setChapters((prev) =>
      [...prev, newChapter].sort((a, b) => a.chapterNumber - b.chapterNumber)
    );
    setShowAddModal(false);
    showToast(`Chapter ${newChapter.chapterNumber} added!`, "success");
  }, []);

  const handleDelete = async () => {
    if (!window.confirm("Delete this comic and all its chapters permanently?")) return;
    try {
      await axios.delete(`${BASE_URL}/${id}`, { data: { email: user.email } });
      navigate("/comics");
    } catch (err) {
      showToast(err.response?.data?.error || "Delete failed.", "error");
    }
  };

  const isOwner = user && comic && user.email === comic.email;

  if (loading) return <ComicLoader message="Loading the story…" />;
  if (error)   return <div className="errorState">{error}</div>;
  if (!comic)  return null;

  const latestIdx = allChapters.length - 1;

  const readFirst = () => {
    const first = allChapters[0];
    if (!first) return;
    handleChapterRead(first);
    navigate(first.isOriginal ? `/comics/${id}/read` : `/comics/${id}/read/${first._id}`);
  };

  const readLatest = () => {
    const last = allChapters[latestIdx];
    if (!last) return;
    handleChapterRead(last);
    navigate(last.isOriginal ? `/comics/${id}/read` : `/comics/${id}/read/${last._id}`);
  };

  return (
    <div className="detailPage">
      <Toast msg={toast.msg} type={toast.type} />

      {showAddModal && (
        <AddChapterModal
          comicId={id}
          existingNumbers={allChapters.map((c) => c.chapterNumber)}
          userEmail={user?.email}
          onAdded={handleChapterAdded}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showCollabModal && (
        <CollabRequestModal
          comic={comic}
          onClose={() => setShowCollabModal(false)}
          onSent={handleCollabSent}
        />
      )}

      <div className="pageHeading"><h1>{comic.comicName}</h1></div>

      {/* ── TOP: cover + meta side by side ─────────────────────────────── */}
      <div className="detailTop">
        <div className="detailCoverWrap">
          <img className="detailCover" src={comic.coverImage?.url} alt={comic.comicName} />
        </div>

        <div className="detailMeta">
          <h2 className="detailTitle">{comic.comicName}</h2>
          <p className="detailAuthor">by{" "}<Link to={`/artist/${encodeURIComponent(comic.authorName || "Anonymous")}`} className="artistLink">{comic.authorName || "Anonymous"}</Link></p>

          <div className="detailTags">
            {(Array.isArray(comic.genre) ? comic.genre : [comic.genre]).map((g, i) => (
              <span key={i} className="metaChip genreTag">{g}</span>
            ))}
            <span className="metaChip clickChip">👁 {comic.clickCount || 0} views</span>
            <span className="metaChip">
              {allChapters.length} Ch{allChapters.length !== 1 ? "s" : ""}
            </span>
            {comic.collabOpen && (
              <span className="metaChip collabBadge">🤝 Open for Collab</span>
            )}
          </div>

          <p className="detailDescription">{comic.description}</p>

          <div className="detailActions">
            <button className="btn btn-primary" onClick={readFirst}>Read First</button>
            {allChapters.length > 1 && (
              <button className="btn btn-primary" onClick={readLatest}>Read Latest</button>
            )}
            <LikeBookmark comicId={id} />

            {/* ── Collab button (non-owners only) ── */}
            {user && !isOwner && (() => {
              if (collabReqStatus === "accepted" && myCollabChatId) {
                return (
                  <button className="btn btn-collab active" onClick={() => navigate(`/collab/${myCollabChatId}`)}>
                    💬 Open Chat
                  </button>
                );
              }
              if (collabReqStatus === "pending") {
                return <button className="btn btn-collab pending" disabled>🕐 Request Pending</button>;
              }
              if (comic.collabOpen) {
                return (
                  <button className="btn btn-collab" onClick={() => setShowCollabModal(true)}>
                    🤝 Request to Collab
                  </button>
                );
              }
              return null;
            })()}

            {isOwner && (
              <>
                {/* ── Collab toggle (owner only) ── */}
                <div className="collabToggleWrap">
                  <span className="collabToggleLabel">
                    {comic.collabOpen ? "🤝 Collab: On" : "🤝 Collab: Off"}
                  </span>
                  <button
                    className={`collabToggleSwitch ${comic.collabOpen ? "on" : "off"}`}
                    onClick={handleCollabToggle}
                    disabled={togglingCollab}
                    title={comic.collabOpen ? "Close to collaboration requests" : "Open to collaboration requests"}
                  >
                    <span className="collabToggleKnob" />
                  </button>
                </div>
                <button className="btn btn-danger" onClick={handleDelete}>Delete Comic</button>
              </>
            )}
          </div>
        </div>
      </div>

      <hr className="detailDivider" />

      {/* ── BOTTOM: last visited + add chapter + tabs ───────────────────── */}
      <div className="detailBottom">

        {/* Last visited */}
        <LastVisited visit={lastVisit} comicId={id} />

        {/* Owner: add chapter */}
        {isOwner && (
          <button className="addChapterBtn" onClick={() => setShowAddModal(true)}>
            + Add New Chapter
          </button>
        )}

        {/* Tab switcher */}
        <div className="tabBar">
          <button
            className={`tabBtn ${activeTab === "chapters" ? "active" : ""}`}
            onClick={() => setActiveTab("chapters")}
          >
            Chapters ({allChapters.length})
          </button>
          <button
            className={`tabBtn ${activeTab === "comments" ? "active" : ""}`}
            onClick={() => setActiveTab("comments")}
          >
            Comments
          </button>
        </div>

        {activeTab === "chapters" ? (
          <div className="chapterList">
            {allChapters.length === 0 ? (
              <p className="emptyTab">No chapters yet.</p>
            ) : (
              allChapters.map((ch, i) => (
                <ChapterRow
                  key={ch._id || "original"}
                  chapter={ch}
                  comicId={id}
                  isLast={i === latestIdx}
                  onRead={handleChapterRead}
                />
              ))
            )}
          </div>
        ) : (
          <Comments comicId={id} comicOwnerEmail={comic?.email} />
        )}
      </div>
    </div>
  );
};

export default SelectedComic;
