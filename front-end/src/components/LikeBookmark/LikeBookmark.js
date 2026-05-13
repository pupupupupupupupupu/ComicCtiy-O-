import { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import CollectionPicker from "../CollectionPicker/CollectionPicker";
import "./LikeBookmark.css";

const API = process.env.REACT_APP_URL;

const HeartIcon = ({ filled }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const BookmarkIcon = ({ filled }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const LikeBookmark = ({ comicId, compact = false }) => {
  const { user, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  const [liked,           setLiked]           = useState(false);
  const [likeCount,       setLikeCount]        = useState(0);
  const [bookmarked,      setBookmarked]       = useState(false);
  const [bookmarkedColIds,setBookmarkedColIds] = useState([]);
  const [showPicker,      setShowPicker]       = useState(false);
  const [likeLoading,     setLikeLoading]      = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!comicId) return;
    try {
      const [likeRes, bmRes] = await Promise.all([
        axios.get(`${API}/api/likes/status`, { params: { userId: user?.sub || "", comicId } }),
        user
          ? axios.get(`${API}/api/bookmarks/status`, { params: { userId: user.sub, comicId } })
          : Promise.resolve({ data: { bookmarked: false, collectionIds: [] } }),
      ]);
      setLiked(likeRes.data.liked);
      setLikeCount(likeRes.data.count);
      setBookmarked(bmRes.data.bookmarked);
      setBookmarkedColIds(bmRes.data.collectionIds || []);
    } catch {}
  }, [comicId, user]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleLike = async () => {
    if (!user) {
      loginWithRedirect({ appState: { returnTo: window.location.pathname } });
      return;
    }
    setLikeLoading(true);
    try {
      const res = await axios.post(`${API}/api/likes/toggle`, { userId: user.sub, comicId });
      setLiked(res.data.liked);
      setLikeCount(res.data.count);
    } catch {}
    setLikeLoading(false);
  };

  const handleBookmarkClick = () => {
    if (!user) {
      loginWithRedirect({ appState: { returnTo: window.location.pathname } });
      return;
    }
    setShowPicker(true);
  };

  const handleBookmarkChange = (newBookmarked, newColIds) => {
    setBookmarked(newBookmarked);
    setBookmarkedColIds(newColIds);
  };

  return (
    <>
      <div className={`likeBookmarkBar ${compact ? "compact" : ""}`}>
        {/* Like button */}
        <button
          className={`lbBtn likeBtn ${liked ? "active" : ""}`}
          onClick={handleLike}
          disabled={likeLoading}
          aria-label={liked ? "Unlike" : "Like"}
          title={user ? (liked ? "Unlike" : "Like") : "Sign in to like"}
        >
          <HeartIcon filled={liked} />
          {!compact && <span className="lbCount">{likeCount}</span>}
        </button>

        {/* Bookmark button */}
        <button
          className={`lbBtn bookmarkBtn ${bookmarked ? "active" : ""}`}
          onClick={handleBookmarkClick}
          aria-label={bookmarked ? "Bookmarked" : "Bookmark"}
          title={user ? (bookmarked ? "Bookmarked" : "Add to bookmarks") : "Sign in to bookmark"}
        >
          <BookmarkIcon filled={bookmarked} />
          {!compact && <span className="lbLabel">{bookmarked ? "Saved" : "Save"}</span>}
        </button>
      </div>

      {showPicker && user && (
        <CollectionPicker
          userId={user.sub}
          comicId={comicId}
          currentColIds={bookmarkedColIds}
          onClose={() => setShowPicker(false)}
          onChange={handleBookmarkChange}
        />
      )}
    </>
  );
};

export default LikeBookmark;
