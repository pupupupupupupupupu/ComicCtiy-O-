import "./UserProfile.css";
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import ComicLoader from "../../components/ComicLoader";

const API = process.env.REACT_APP_URL;

const UserProfile = () => {
  const { userId }  = useParams();
  const navigate    = useNavigate();
  const decodedId   = decodeURIComponent(userId);

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [expandedCol, setExpandedCol] = useState({});

  useEffect(() => {
    axios.get(`${API}/api/profile/public/${encodeURIComponent(decodedId)}`)
      .then((r) => {
        setData(r.data);
        // Auto-expand first collection
        if (r.data.collections?.[0]) {
          setExpandedCol({ [r.data.collections[0]._id]: true });
        }
      })
      .catch(() => setError("User not found or profile is private."))
      .finally(() => setLoading(false));
  }, [decodedId]);

  if (loading) return <ComicLoader message="Loading profile…" />;
  if (error)   return (
    <div className="upError">
      <p>{error}</p>
      <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
    </div>
  );

  const { profile, collections } = data;
  const displayName = profile.displayNamePref === "username" && profile.username
    ? profile.username
    : profile.username || "Anonymous";

  const joinDate = new Date(profile.createdAt).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  return (
    <div className="upPage">
      <div className="pageHeading"><h1>User Profile</h1></div>

      {/* Profile card */}
      <div className="upCard">
        <div className="upAvatarWrap">
          {profile.customPicture?.url
            ? <img src={profile.customPicture.url} alt={displayName} className="upAvatar" />
            : <div className="upAvatarFallback">{displayName[0].toUpperCase()}</div>
          }
        </div>
        <div className="upInfo">
          <h2 className="upDisplayName">{displayName}</h2>
          {profile.username && profile.displayNamePref !== "username" && (
            <p className="upUsername">@{profile.username}</p>
          )}
          {profile.bio && <p className="upBio">{profile.bio}</p>}
          <p className="upJoined">Member since {joinDate}</p>
        </div>
      </div>

      {/* Public collections */}
      <div className="upCollections">
        <h3 className="upSectionTitle">📚 Public Collections</h3>

        {collections.length === 0 ? (
          <p className="upEmpty">This user has no public collections.</p>
        ) : (
          collections.map((col) => (
            <div key={col._id} className="upColGroup">
              <button
                className="upColHeader"
                onClick={() => setExpandedCol((e) => ({ ...e, [col._id]: !e[col._id] }))}
              >
                <span>{col.isDefault ? "📚" : "📁"} {col.name}</span>
                <span className="upColMeta">{col.comicCount || 0} comics {expandedCol[col._id] ? "▲" : "▼"}</span>
              </button>

              {expandedCol[col._id] && (
                <PublicCollectionComics collectionId={col._id} userId={decodedId} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Lazy-load comics in a public collection
const PublicCollectionComics = ({ collectionId, userId }) => {
  const navigate = useNavigate();
  const [comics,  setComics]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/bookmarks/${encodeURIComponent(userId)}`)
      .then((res) => {
        const group = res.data.find((g) => String(g.collection._id) === String(collectionId));
        setComics(group?.comics || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collectionId, userId]);

  if (loading) return <div className="upColLoading">Loading…</div>;
  if (!comics.length) return <div className="upColEmpty">No comics in this collection.</div>;

  return (
    <div className="upComicGrid">
      {comics.map((c) => (
        <div key={c._id} className="upMiniCard" onClick={() => navigate(`/comics/${c._id}`)}>
          <img src={c.coverImage?.url} alt={c.comicName} loading="lazy" />
          <p>{c.comicName}</p>
        </div>
      ))}
    </div>
  );
};

export default UserProfile;
