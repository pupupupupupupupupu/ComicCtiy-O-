import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import CollectionPicker from "../CollectionPicker/CollectionPicker";
import "./QuickSave.css";

const API = process.env.REACT_APP_URL;

const HeartIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const BookmarkIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

// Lightweight like/bookmark buttons that appear on card hover.
// Status is NOT pre-fetched — it's loaded lazily on first interaction to
// keep grid pages fast. State is optimistic after the first fetch.
const QuickSave = ({ comicId, onCardClick }) => {
  const { user, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  const [statusLoaded,    setStatusLoaded]    = useState(false);
  const [liked,           setLiked]           = useState(false);
  const [bookmarked,      setBookmarked]       = useState(false);
  const [bookmarkedColIds,setBookmarkedColIds] = useState([]);
  const [showPicker,      setShowPicker]       = useState(false);
  const [busy,            setBusy]             = useState(false);

  // Load status lazily when user first hovers/touches the card
  const ensureStatus = async () => {
    if (statusLoaded || !user) return;
    try {
      const [likeRes, bmRes] = await Promise.all([
        axios.get(`${API}/api/likes/status`, { params: { userId: user.sub, comicId } }),
        axios.get(`${API}/api/bookmarks/status`, { params: { userId: user.sub, comicId } }),
      ]);
      setLiked(likeRes.data.liked);
      setBookmarked(bmRes.data.bookmarked);
      setBookmarkedColIds(bmRes.data.collectionIds || []);
      setStatusLoaded(true);
    } catch {}
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user) {
      loginWithRedirect({ appState: { returnTo: window.location.pathname } });
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post(`${API}/api/likes/toggle`, { userId: user.sub, comicId });
      setLiked(res.data.liked);
      setStatusLoaded(true);
    } catch {}
    setBusy(false);
  };

  const handleBookmark = (e) => {
    e.stopPropagation();
    if (!user) {
      loginWithRedirect({ appState: { returnTo: window.location.pathname } });
      return;
    }
    setShowPicker(true);
  };

  const handlePickerChange = (newBookmarked, newColIds) => {
    setBookmarked(newBookmarked);
    setBookmarkedColIds(newColIds);
    setStatusLoaded(true);
  };

  return (
    <>
      <div className="quickSaveBar" onMouseEnter={ensureStatus}>
        <button
          className={`qsBtn like ${liked ? "active" : ""}`}
          onClick={handleLike}
          disabled={busy}
          title={liked ? "Unlike" : "Like"}
        >
          <HeartIcon filled={liked} />
        </button>
        <button
          className={`qsBtn bookmark ${bookmarked ? "active" : ""}`}
          onClick={handleBookmark}
          title={bookmarked ? "Bookmarked" : "Save"}
        >
          <BookmarkIcon filled={bookmarked} />
        </button>
      </div>

      {showPicker && user && (
        <div onClick={(e) => e.stopPropagation()}>
          <CollectionPicker
            userId={user.sub}
            comicId={comicId}
            currentColIds={bookmarkedColIds}
            onClose={() => setShowPicker(false)}
            onChange={handlePickerChange}
          />
        </div>
      )}
    </>
  );
};

export default QuickSave;
