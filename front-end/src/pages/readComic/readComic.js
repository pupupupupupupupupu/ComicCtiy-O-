import "./readComic.css";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import ComicLoader from "../../components/ComicLoader";
import LikeBookmark from "../../components/LikeBookmark/LikeBookmark";

const BASE_URL    = `${process.env.REACT_APP_URL}/api/comics`;
const HISTORY_KEY = (comicId) => `cc_history_${comicId}`;

/* ── Chapter list dropdown ────────────────────────────────────────────────── */
const ChapterDropdown = ({ chapters, currentChapterId, comicId, onSelect, onClose }) => {
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="chapterDropdownOverlay">
      <div className="chapterDropdownPanel" ref={panelRef}>
        <div className="chapterDropdownHeader">
          <span className="chapterDropdownTitle">☰ Chapter List</span>
          <button className="chapterDropdownClose" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="chapterDropdownList">
          {chapters.map((ch) => {
            const isActive = ch.isOriginal
              ? !currentChapterId
              : ch._id === currentChapterId;
            return (
              <div
                key={ch._id || "original"}
                className={`chapterDropdownItem ${isActive ? "active" : ""}`}
                onClick={() => { onSelect(ch); onClose(); }}
              >
                <span className="dropdownChBadge">Ch.{ch.chapterNumber}</span>
                <span className="dropdownChTitle">
                  {ch.title || `Chapter ${ch.chapterNumber}`}
                </span>
                {isActive && <span className="dropdownChCurrent">Reading</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ── Nav bar ─────────────────────────────────────────────────────────────── */
const NavBar = ({ prevChapter, nextChapter, allChapters, currentChapterId, comicId, onNavigate, position }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className={`chapterNav ${position === "bottom" ? "bottom" : ""}`}>
      <button
        className="chapterNavBtn"
        disabled={!prevChapter}
        onClick={() => prevChapter && onNavigate(prevChapter)}
      >
        ← Prev
      </button>

      {/* Chapter list toggle */}
      <div className="chapterNavCenter">
        <button
          className="chapterNavBtn listBtn"
          onClick={() => setShowDropdown((v) => !v)}
        >
          ☰ Chapters
        </button>

        {showDropdown && (
          <ChapterDropdown
            chapters={allChapters}
            currentChapterId={currentChapterId}
            comicId={comicId}
            onSelect={onNavigate}
            onClose={() => setShowDropdown(false)}
          />
        )}
      </div>

      <button
        className="chapterNavBtn"
        disabled={!nextChapter}
        onClick={() => nextChapter && onNavigate(nextChapter)}
      >
        Next →
      </button>
    </div>
  );
};

/* ── Main reader ─────────────────────────────────────────────────────────── */
const ReadComic = () => {
  const { id: comicId, chapterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth0();

  const [comic,       setComic]       = useState(null);
  const [chapter,     setChapter]     = useState(null);
  const [allChapters, setAllChapters] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [comicRes, chaptersRes] = await Promise.all([
          axios.get(`${BASE_URL}/${comicId}`),
          axios.get(`${BASE_URL}/${comicId}/chapters`),
        ]);
        const comicData     = comicRes.data;
        const extraChapters = chaptersRes.data || [];

        setComic(comicData);

        // Full ordered chapter list
        const full = [
          { _id: null, isOriginal: true, chapterNumber: comicData.chapterNumber,
            title: comicData.comicName, comicImages: comicData.comicImages },
          ...extraChapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
        ];
        setAllChapters(full);

        // Which chapter are we reading?
        if (chapterId) {
          const ch = extraChapters.find((c) => c._id === chapterId);
          if (!ch) throw new Error("Chapter not found");
          setChapter(ch);
          recordVisit(comicData, ch);
        } else {
          setChapter(null);
          recordVisit(comicData, null);
        }
      } catch (err) {
        setError(err.message || "Could not load this chapter.");
      } finally {
        setLoading(false);
      }
    };

    const recordVisit = (comicData, ch) => {
      const entry = {
        chapterNumber: ch ? ch.chapterNumber : comicData.chapterNumber,
        chapterId:     ch ? ch._id : null,
        visitedAt:     new Date().toISOString(),
      };
      try { localStorage.setItem(HISTORY_KEY(comicId), JSON.stringify(entry)); } catch {}
      if (user) {
        axios.post(`${process.env.REACT_APP_URL}/api/history`, {
          userId: user.sub, comicId,
          comicName: comicData.comicName, coverUrl: comicData.coverImage?.url,
          chapterNumber: entry.chapterNumber, chapterId: entry.chapterId,
        }).catch(() => {});
      }
    };

    fetchAll();
  }, [comicId, chapterId, user]);

  const handleNavigate = (ch) => {
    // Scroll to top when switching chapters
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (ch.isOriginal) navigate(`/comics/${comicId}/read`);
    else navigate(`/comics/${comicId}/read/${ch._id}`);
  };

  if (loading) return <ComicLoader message="Turning the page…" />;
  if (error)   return <div className="readerError">{error}</div>;
  if (!comic)  return null;

  const pages = chapter ? (chapter.comicImages || []) : (comic.comicImages || []);
  const currentChapterNum = chapter ? chapter.chapterNumber : comic.chapterNumber;

  const currentIndex = allChapters.findIndex((c) =>
    chapterId ? c._id === chapterId : c.isOriginal
  );
  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

  const navProps = { prevChapter, nextChapter, allChapters, currentChapterId: chapterId || null, comicId, onNavigate: handleNavigate };

  return (
    <div className="readerPage">
      <div className="pageHeading">
        <h1>{comic.comicName} — Ch.{currentChapterNum}</h1>
      </div>

      <NavBar {...navProps} position="top" />

      {/* Like & Bookmark — compact pill buttons float above reader */}
      <div className="readerSocialBar">
        <LikeBookmark comicId={comicId} compact={true} />
      </div>

      {pages.length === 0 ? (
        <div className="readerEmpty">No pages uploaded for this chapter yet.</div>
      ) : (
        <div className="comicReaderContainer">
          {pages.map((page, i) => (
            <img
              key={page.public_id || i}
              src={page.url}
              alt={`Page ${i + 1}`}
              loading="lazy"
              className="comicPage"
            />
          ))}
        </div>
      )}

      <NavBar {...navProps} position="bottom" />
    </div>
  );
};

export default ReadComic;
