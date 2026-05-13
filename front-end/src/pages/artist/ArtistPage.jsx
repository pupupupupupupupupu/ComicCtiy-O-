import "./ArtistPage.css";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import ComicCard from "../../components/ComicCard/ComicCard";
import ComicLoader from "../../components/ComicLoader";

const BASE_URL = process.env.REACT_APP_URL;

const ArtistPage = () => {
  const { name }   = useParams();
  const navigate   = useNavigate();
  const { user, loginWithRedirect } = useAuth0();

  const artistName = decodeURIComponent(name || "");

  const [comics,    setComics]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [page,      setPage]      = useState(1);
  const [pagination,setPagination]= useState({});
  const [following, setFollowing] = useState(false);
  const [followBusy,setFollowBusy]= useState(false);

  // Fetch comics by this artist
  const fetchComics = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${BASE_URL}/api/comics/artist/${encodeURIComponent(artistName)}?page=${p}&limit=20`
      );
      setComics(res.data.comics || []);
      setPagination(res.data.pagination || {});
    } catch { setError("Couldn't load this artist's comics."); }
    finally  { setLoading(false); }
  }, [artistName]);

  // Fetch follow status
  const fetchFollowStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/saved-artists/status`, {
        params: { userId: encodeURIComponent(user.sub), artistName },
      });
      setFollowing(res.data.following);
    } catch {}
  }, [user, artistName]);

  useEffect(() => { fetchComics(1); fetchFollowStatus(); }, [fetchComics, fetchFollowStatus]);

  const handleFollow = async () => {
    if (!user) { loginWithRedirect({ appState: { returnTo: window.location.pathname } }); return; }
    setFollowBusy(true);
    try {
      if (following) {
        await axios.delete(`${BASE_URL}/api/saved-artists`, { data: { userId: user.sub, artistName } });
        setFollowing(false);
      } else {
        await axios.post(`${BASE_URL}/api/saved-artists`, { userId: user.sub, artistName });
        setFollowing(true);
      }
    } catch {}
    setFollowBusy(false);
  };

  return (
    <div className="artistPage">
      <div className="pageHeading"><h1>Artist</h1></div>

      <div className="artistHeader">
        <div className="artistAvatarPlaceholder">
          {artistName[0]?.toUpperCase() || "?"}
        </div>
        <div className="artistHeaderInfo">
          <h2 className="artistName">{artistName}</h2>
          <p className="artistComicCount">
            {pagination.total ?? comics.length} comic{(pagination.total ?? comics.length) !== 1 ? "s" : ""} published
          </p>
        </div>
        <button
          className={`btn ${following ? "btn-secondary" : "btn-primary"} followBtn`}
          onClick={handleFollow}
          disabled={followBusy}
        >
          {followBusy ? "…" : following ? "✓ Following" : "+ Follow Artist"}
        </button>
      </div>

      {loading ? (
        <ComicLoader message="Finding their work…" />
      ) : error ? (
        <div className="artistError">{error}</div>
      ) : comics.length === 0 ? (
        <div className="artistEmpty">No comics found for this artist.</div>
      ) : (
        <>
          <div className="comicGrid" style={{ maxWidth: 1200, margin: "0 auto" }}>
            {comics.map((c) => <ComicCard key={c._id} comic={c} />)}
          </div>

          {pagination.pages > 1 && (
            <div className="artistPagination">
              <button className="btn btn-secondary" disabled={page === 1}
                onClick={() => { setPage(p => p - 1); fetchComics(page - 1); }}>
                ← Prev
              </button>
              <span className="artistPageInfo">Page {pagination.page} of {pagination.pages}</span>
              <button className="btn btn-secondary" disabled={page >= pagination.pages}
                onClick={() => { setPage(p => p + 1); fetchComics(page + 1); }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ArtistPage;
