import "./Popular.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ComicLoader from "../../components/ComicLoader";
import QuickSave from "../../components/QuickSave/QuickSave";

const BASE_URL = `${process.env.REACT_APP_URL}/api/comics`;
const LIMIT = 20;

const Popular = () => {
  const navigate = useNavigate();
  const [comics, setComics] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const sentinelRef = useRef(null);

  const fetchPage = useCallback(async (pageNum, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const res = await axios.get(
        `${BASE_URL}?sort=weekly&page=${pageNum}&limit=${LIMIT}`
      );
      const { comics: newComics, pagination } = res.data;
      setComics((prev) => (append ? [...prev, ...newComics] : newComics));
      setTotalPages(pagination.pages || 1);
    } catch {
      setError("Couldn't load popular comics.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  // Intersection Observer for lazy loading next page
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && page < totalPages && !loadingMore) {
          const next = page + 1;
          setPage(next);
          fetchPage(next, true);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, totalPages, loadingMore, fetchPage]);

  return (
    <div className="popularPage">
      <div className="pageHeading">
        <h1>🔥 Popular This Week</h1>
      </div>

      {loading ? (
        <ComicLoader message="Counting the votes…" />
      ) : error ? (
        <div className="errorMsg">{error}</div>
      ) : comics.length === 0 ? (
        <div className="emptyState">
          <p>No comics yet. Be the first to upload!</p>
        </div>
      ) : (
        <>
          <div className="popularGrid">
            {comics.map((comic, rank) => (
              <div
                key={comic._id}
                className="popularCard"
                onClick={() =>
                  navigate(`/comics/${comic._id}`, { state: comic })
                }
              >
                <div className="rankBadge">#{rank + 1}</div>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={comic.coverImage?.url}
                    alt={comic.comicName}
                    loading="lazy"
                    className="popularCover"
                  />
                  <QuickSave comicId={String(comic._id)} />
                </div>
                <div className="popularInfo">
                  <h3 className="popularName">{comic.comicName}</h3>
                  <p className="popularAuthor">{comic.authorName || "Anonymous"}</p>
                  <div className="popularMeta">
                    <span className="metaChip genreTag">
                      {Array.isArray(comic.genre) ? comic.genre[0] : comic.genre}
                    </span>
                    <span className="metaChip clickChip">
                      🔥 {comic.weeklyClickCount || 0} this week
                    </span>
                    <span className="metaChip">
                      👁 {comic.clickCount || 0} total
                    </span>
                  </div>
                  <p className="popularDesc">
                    {comic.description?.slice(0, 100)}
                    {comic.description?.length > 100 ? "…" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Intersection sentinel for infinite scroll */}
          <div ref={sentinelRef} className="sentinel" />

          {loadingMore && (
            <ComicLoader message="Loading more…" />
          )}
        </>
      )}
    </div>
  );
};

export default Popular;
