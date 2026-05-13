import "./Profile.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import axios from "axios";
import ComicLoader from "../../components/ComicLoader";

const API     = process.env.REACT_APP_URL;
const CLD_NAME   = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const CLD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

const toBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});

/* ── Stat badge ─────────────────────────────────────────────────────────── */
const StatBadge = ({ label, value }) => (
  <div className="statBadge">
    <span className="statValue">{value}</span>
    <span className="statLabel">{label}</span>
  </div>
);

/* ── DP upload area ──────────────────────────────────────────────────────── */
const AvatarUpload = ({ currentUrl, defaultUrl, onUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const base64 = await toBase64(file);
      onUploaded(base64);
    } catch {}
    setUploading(false);
  };

  const src = preview || currentUrl || defaultUrl;

  return (
    <div className="avatarUploadWrap">
      <img src={src} alt="Profile" className="profileAvatar" />
      <button className="avatarEditBtn" onClick={() => inputRef.current?.click()}
        title="Change profile picture" disabled={uploading}>
        {uploading ? "…" : "✏️"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={handleFile} />
    </div>
  );
};

/* ── Mini card ──────────────────────────────────────────────────────────── */
const MiniCard = ({ comic, onNavigate }) => (
  <div className="miniCard" onClick={() => onNavigate(`/comics/${comic._id}`)}>
    <img src={comic.coverImage?.url} alt={comic.comicName} loading="lazy" />
    <p className="miniCardName">{comic.comicName}</p>
  </div>
);

/* ── Bookmarks tab ──────────────────────────────────────────────────────── */
const BookmarksTab = ({ userId }) => {
  const navigate = useNavigate();
  const [groups,   setGroups]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState({});
  const [toggling, setToggling] = useState({});

  useEffect(() => {
    axios.get(`${API}/api/bookmarks/${userId}`)
      .then((r) => {
        setGroups(r.data);
        if (r.data[0]) setExpanded({ [r.data[0].collection._id]: true });
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const toggleExpanded = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const togglePrivacy = async (col) => {
    setToggling((t) => ({ ...t, [col._id]: true }));
    try {
      const res = await axios.patch(`${API}/api/collections/${col._id}/privacy`, { userId });
      setGroups((g) => g.map((gr) =>
        String(gr.collection._id) === String(col._id)
          ? { ...gr, collection: { ...gr.collection, isPublic: res.data.isPublic } }
          : gr
      ));
    } catch {}
    setToggling((t) => ({ ...t, [col._id]: false }));
  };

  const removeBookmark = async (comicId, collectionId, bookmarkId) => {
    await axios.delete(`${API}/api/bookmarks`, { data: { userId, comicId, collectionId } });
    setGroups((g) => g.map((gr) =>
      String(gr.collection._id) === String(collectionId)
        ? { ...gr, comics: gr.comics.filter((c) => c.bookmarkId !== bookmarkId) }
        : gr
    ).filter((gr) => gr.comics.length > 0));
  };

  if (loading) return <ComicLoader message="Loading bookmarks…" />;
  if (!groups.length) return <div className="profileEmpty">No bookmarks yet. Start saving comics!</div>;

  return (
    <div className="bookmarkGroups">
      {groups.map(({ collection, comics }) => (
        <div key={collection._id} className="bookmarkGroup">
          <div className="groupHeaderRow">
            <button className="groupHeader" onClick={() => toggleExpanded(collection._id)}>
              <span className="groupName">
                {collection.isDefault ? "📚" : "📁"} {collection.name}
              </span>
              <span className="groupCount">{comics.length} comic{comics.length !== 1 ? "s" : ""}</span>
              <span className="groupChevron">{expanded[collection._id] ? "▲" : "▼"}</span>
            </button>

            {/* Privacy toggle */}
            <button
              className={`privacyToggle ${collection.isPublic ? "public" : "private"}`}
              onClick={() => togglePrivacy(collection)}
              disabled={toggling[collection._id]}
              title={collection.isPublic ? "Make private" : "Make public"}
            >
              {collection.isPublic ? "🌐 Public" : "🔒 Private"}
            </button>
          </div>

          {expanded[collection._id] && (
            <div className="bookmarkGrid">
              {comics.map((c) => (
                <div key={c.bookmarkId} className="bookmarkItem">
                  <MiniCard comic={c} onNavigate={navigate} />
                  <button className="removeBookmarkBtn"
                    onClick={() => removeBookmark(c._id, collection._id, c.bookmarkId)}
                    title="Remove">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/* ── Likes tab ──────────────────────────────────────────────────────────── */
const LikesTab = ({ userId }) => {
  const navigate = useNavigate();
  const [likes,   setLikes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/api/likes/${userId}?page=${page}`)
      .then((r) => { setLikes(r.data.likes); setPages(r.data.pagination.pages); })
      .finally(() => setLoading(false));
  }, [userId, page]);

  if (loading) return <ComicLoader message="Loading liked comics…" />;
  if (!likes.length) return <div className="profileEmpty">No liked comics yet.</div>;

  return (
    <>
      <div className="profileMiniGrid">
        {likes.map(({ _id, comic }) => comic && <MiniCard key={_id} comic={comic} onNavigate={navigate} />)}
      </div>
      {pages > 1 && (
        <div className="profilePagination">
          <button className="btn btn-primary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page {page} of {pages}</span>
          <button className="btn btn-primary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </>
  );
};

/* ── Comments tab ───────────────────────────────────────────────────────── */
const CommentsTab = ({ userId }) => {
  const [comments, setComments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/api/profile/${userId}/comments?page=${page}`)
      .then((r) => { setComments(r.data.comments); setPages(r.data.pagination.pages); })
      .finally(() => setLoading(false));
  }, [userId, page]);

  if (loading) return <ComicLoader message="Loading comments…" />;
  if (!comments.length) return <div className="profileEmpty">No comments yet.</div>;

  return (
    <>
      <div className="commentHistoryList">
        {comments.map((c) => (
          <Link key={c._id} to={`/comics/${c.comicId}`} className="commentHistoryItem">
            {c.comic?.coverImage?.url && (
              <img src={c.comic.coverImage.url} alt={c.comic?.comicName} className="commentHistoryThumb" />
            )}
            <div className="commentHistoryBody">
              <span className="commentHistoryComic">{c.comic?.comicName || "Unknown comic"}</span>
              <p className="commentHistoryText">{c.text}</p>
              <span className="commentHistoryDate">
                {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </Link>
        ))}
      </div>
      {pages > 1 && (
        <div className="profilePagination">
          <button className="btn btn-primary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page {page} of {pages}</span>
          <button className="btn btn-primary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </>
  );
};

/* ── Settings tab ───────────────────────────────────────────────────────── */
const SettingsTab = ({ userId, profile, authUser, onUpdate }) => {
  const [username,    setUsername]    = useState(profile.username || "");
  const [displayPref, setDisplayPref] = useState(profile.displayNamePref || "account");
  const [bio,         setBio]         = useState(profile.bio || "");
  const [saving,      setSaving]      = useState(false);
  const [uploadingPic,setUploadingPic]= useState(false);
  const [msg,         setMsg]         = useState({ text: "", type: "" });

  const showMsg = (text, type) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: "", type: "" }), 3500); };

  // Handle DP upload — base64 → backend → Cloudinary
  const handlePictureUpload = async (base64) => {
    setUploadingPic(true);
    try {
      const res = await axios.patch(`${API}/api/profile/${userId}/picture`, { imageBase64: base64 });
      onUpdate(res.data);
      showMsg("Profile picture updated!", "success");
    } catch {
      showMsg("Picture upload failed.", "error");
    }
    setUploadingPic(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const accountName = authUser.name || authUser.email;
      const res = await axios.patch(`${API}/api/profile/${userId}`, {
        username, displayNamePref: displayPref, bio, accountName,
      });
      onUpdate(res.data);
      showMsg("Profile updated!", "success");
    } catch (err) {
      showMsg(err.response?.data?.error || "Update failed.", "error");
    }
    setSaving(false);
  };

  const picUrl = profile.customPicture?.url || authUser.picture;

  return (
    <div className="settingsForm">
      {msg.text && <div className={`settingsMsg ${msg.type}`}>{msg.text}</div>}

      {/* Profile picture */}
      <div className="settingsGroup">
        <label className="settingsLabel">Profile Picture</label>
        <div className="dpSection">
          <AvatarUpload currentUrl={picUrl} defaultUrl={authUser.picture} onUploaded={handlePictureUpload} />
          <p className="settingsHint">
            {uploadingPic ? "Uploading…" : "Click the pencil to change your photo."}
          </p>
        </div>
      </div>

      {/* Username */}
      <div className="settingsGroup">
        <label className="settingsLabel">Username</label>
        <input className="settingsInput" type="text" value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a unique username" minLength={3} maxLength={30} />
        <span className="settingsHint">3–30 characters. Used as your public handle.</span>
      </div>

      {/* Display name preference */}
      <div className="settingsGroup">
        <label className="settingsLabel">Display Name shown in comments</label>
        <div className="radioGroup">
          <label className={`radioOption ${displayPref === "account" ? "selected" : ""}`}>
            <input type="radio" name="displayPref" value="account"
              checked={displayPref === "account"} onChange={() => setDisplayPref("account")} />
            Account name ({authUser.name || authUser.email})
          </label>
          <label className={`radioOption ${displayPref === "username" ? "selected" : ""}`}>
            <input type="radio" name="displayPref" value="username"
              checked={displayPref === "username"} onChange={() => setDisplayPref("username")}
              disabled={!username} />
            Username {username ? `(@${username})` : "(set a username first)"}
          </label>
        </div>
        <span className="settingsHint">Saving updates your name on all your existing comments.</span>
      </div>

      {/* Bio */}
      <div className="settingsGroup">
        <label className="settingsLabel">Bio</label>
        <textarea className="settingsInput settingsTextarea" value={bio}
          onChange={(e) => setBio(e.target.value)} maxLength={300}
          placeholder="Tell us a bit about yourself…" rows={3} />
        <span className="settingsHint">{bio.length}/300</span>
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
};


/* ── Saved Artists tab ─────────────────────────────────────────────────── */
const ArtistsTab = ({ userId }) => {
  const navigate = useNavigate();
  const [artists,  setArtists]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [unfollowing, setUnfollowing] = useState({});

  useEffect(() => {
    axios.get(`${API}/api/saved-artists/${encodeURIComponent(userId)}`)
      .then((r) => setArtists(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleUnfollow = async (artistName) => {
    setUnfollowing((u) => ({ ...u, [artistName]: true }));
    try {
      await axios.delete(`${API}/api/saved-artists`, { data: { userId, artistName } });
      setArtists((a) => a.filter((x) => x.artistName !== artistName));
    } catch {}
    setUnfollowing((u) => ({ ...u, [artistName]: false }));
  };

  if (loading) return <ComicLoader message="Loading followed artists…" />;
  if (!artists.length) return (
    <div className="profileEmpty">
      You haven't followed any artists yet.
      <br /><span style={{ fontSize: "0.85rem", color: "#999" }}>Visit an artist's page and click Follow.</span>
    </div>
  );

  return (
    <div className="artistsList">
      {artists.map((a) => (
        <div key={a._id} className="artistRow">
          <div className="artistRowAvatar" onClick={() => navigate(`/artist/${encodeURIComponent(a.artistName)}`)}>
            {a.artistName[0]?.toUpperCase()}
          </div>
          <span className="artistRowName" onClick={() => navigate(`/artist/${encodeURIComponent(a.artistName)}`)}>
            {a.artistName}
          </span>
          <button
            className="btn btn-secondary unfollowBtn"
            onClick={() => handleUnfollow(a.artistName)}
            disabled={unfollowing[a.artistName]}
          >
            {unfollowing[a.artistName] ? "…" : "Unfollow"}
          </button>
        </div>
      ))}
    </div>
  );
};

/* ── Notifications tab ──────────────────────────────────────────────────── */
const TYPE_ICON = {
  collab_request:  "🤝", collab_accepted: "✅",
  collab_declined: "❌", collab_cancelled: "↩️",
  reply: "💬", follow: "👁",
};

const NotificationsTab = ({ userEmail }) => {
  const navigate = useNavigate();
  const [received, setReceived] = useState([]);
  const [sent,     setSent]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [activeSection, setActiveSection] = useState("received");
  const [acting,   setActing]   = useState({});

  useEffect(() => {
    if (!userEmail) return;
    setLoading(true);
    axios.get(`${API}/api/collab/requests/${encodeURIComponent(userEmail)}`)
      .then(({ data }) => {
        setReceived(data.received || []);
        setSent(data.sent || []);
      }).catch(() => {})
      .finally(() => setLoading(false));
  }, [userEmail]);

  const handleAccept = async (req) => {
    setActing((a) => ({ ...a, [req._id]: "accepting" }));
    try {
      const { data } = await axios.patch(`${API}/api/collab/request/${req._id}/accept`, {
        ownerEmail: userEmail,
        ownerName: "", ownerPic: "",
      });
      setReceived((r) => r.map((x) => x._id === req._id ? { ...x, status: "accepted" } : x));
      // Navigate to the newly created chat
      navigate(`/collab/${data.chatId}`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to accept.");
    }
    setActing((a) => ({ ...a, [req._id]: "" }));
  };

  const handleDecline = async (req) => {
    if (!window.confirm("Decline this request?")) return;
    setActing((a) => ({ ...a, [req._id]: "declining" }));
    try {
      await axios.patch(`${API}/api/collab/request/${req._id}/decline`, {
        ownerEmail: userEmail, ownerName: "",
      });
      setReceived((r) => r.map((x) => x._id === req._id ? { ...x, status: "declined" } : x));
    } catch {}
    setActing((a) => ({ ...a, [req._id]: "" }));
  };

  const handleCancel = async (req) => {
    if (!window.confirm("Cancel this request?")) return;
    setActing((a) => ({ ...a, [req._id]: "cancelling" }));
    try {
      await axios.delete(`${API}/api/collab/request/${req._id}`, { data: { requesterEmail: userEmail } });
      setSent((s) => s.map((x) => x._id === req._id ? { ...x, status: "cancelled" } : x));
    } catch {}
    setActing((a) => ({ ...a, [req._id]: "" }));
  };

  const STATUS_COLORS = {
    pending: "#f39c12", accepted: "#28a060", declined: "#e74c3c",
    cancelled: "#aaa", expired: "#bbb",
  };

  const RequestCard = ({ req, type }) => {
    const comic = req.comicId;
    return (
      <div className="collabReqCard">
        <div className="collabReqLeft">
          {comic?.coverImage?.url && (
            <img src={comic.coverImage.url} alt={comic.comicName} className="collabReqCover"
              onClick={() => navigate(`/comics/${comic._id}`)} />
          )}
          <div className="collabReqInfo">
            <p className="collabReqComicName">{comic?.comicName || "Unknown Comic"}</p>
            {type === "received" ? (
              <>
                <p className="collabReqFrom">
                  <strong>{req.requesterName}</strong> wants to join as{" "}
                  <span className="collabRoleChip">{req.role}</span>
                </p>
                <p className="collabReqPitch">"{req.pitch}"</p>
                {req.portfolioUrl && (
                  <a href={req.portfolioUrl} target="_blank" rel="noopener noreferrer" className="collabPortfolioLink">
                    🔗 Portfolio
                  </a>
                )}
              </>
            ) : (
              <>
                <p className="collabReqFrom">Your role: <span className="collabRoleChip">{req.role}</span></p>
                <p className="collabReqPitch">"{req.pitch}"</p>
              </>
            )}
            <p className="collabReqDate">
              {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="collabReqRight">
          <span className="collabReqStatus" style={{ color: STATUS_COLORS[req.status] }}>
            ● {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
          </span>
          {type === "received" && req.status === "pending" && (
            <div className="collabReqActions">
              <button className="btn btn-primary collabActBtn"
                onClick={() => handleAccept(req)}
                disabled={!!acting[req._id]}>
                {acting[req._id] === "accepting" ? "…" : "✓ Accept"}
              </button>
              <button className="btn btn-secondary collabActBtn"
                onClick={() => handleDecline(req)}
                disabled={!!acting[req._id]}>
                {acting[req._id] === "declining" ? "…" : "✗ Decline"}
              </button>
            </div>
          )}
          {type === "sent" && req.status === "pending" && (
            <button className="btn btn-secondary collabActBtn"
              onClick={() => handleCancel(req)}
              disabled={!!acting[req._id]}>
              {acting[req._id] === "cancelling" ? "…" : "Cancel"}
            </button>
          )}
          {req.status === "accepted" && type === "sent" && (
            <button className="btn btn-primary collabActBtn"
              onClick={() => navigate("/profile", { state: { tab: "collaborations" } })}>
              💬 Open Chat
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <ComicLoader message="Loading requests…" />;

  const pendingCount = received.filter((r) => r.status === "pending").length;

  return (
    <div className="notifTabWrap">
      <div className="notifSectionToggle">
        <button
          className={`notifSectionBtn ${activeSection === "received" ? "active" : ""}`}
          onClick={() => setActiveSection("received")}>
          Received {pendingCount > 0 && <span className="notifSectionBadge">{pendingCount}</span>}
        </button>
        <button
          className={`notifSectionBtn ${activeSection === "sent" ? "active" : ""}`}
          onClick={() => setActiveSection("sent")}>
          Sent
        </button>
      </div>

      {activeSection === "received" && (
        received.length === 0
          ? <div className="profileEmpty">No collaboration requests received yet.</div>
          : received.map((r) => <RequestCard key={r._id} req={r} type="received" />)
      )}
      {activeSection === "sent" && (
        sent.length === 0
          ? <div className="profileEmpty">You haven't sent any collaboration requests yet.</div>
          : sent.map((r) => <RequestCard key={r._id} req={r} type="sent" />)
      )}
    </div>
  );
};

/* ── Collaborations tab ──────────────────────────────────────────────────── */
const CollaborationsTab = ({ userEmail }) => {
  const navigate  = useNavigate();
  const [chats,   setChats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");

  useEffect(() => {
    if (!userEmail) return;
    axios.get(`${API}/api/collab/chats/${encodeURIComponent(userEmail)}`)
      .then(({ data }) => setChats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userEmail]);

  if (loading) return <ComicLoader message="Loading collaborations…" />;

  const STATUS_COLORS = { active: "#28a060", paused: "#f39c12", completed: "#7c6ef5", ended: "#e74c3c" };
  const STATUS_ICONS  = { active: "🟢", paused: "⏸️", completed: "✅", ended: "🔴" };

  const filtered = filter === "all" ? chats : chats.filter((c) => c.collabStatus === filter);

  return (
    <div className="collabsTabWrap">
      <div className="collabsFilter">
        {["all", "active", "paused", "completed", "ended"].map((f) => (
          <button key={f} className={`collabsFilterBtn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="profileEmpty">
          {filter === "all"
            ? "No collaborations yet. Send a collab request from a comic page!"
            : `No ${filter} collaborations.`}
        </div>
      ) : (
        <div className="collabsList">
          {filtered.map((chat) => {
            const comic   = chat.comicId;
            const partner = chat.partner;
            const status  = chat.collabStatus;
            return (
              <div key={chat._id} className="collabCard">
                <img src={comic?.coverImage?.url} alt={comic?.comicName} className="collabCardCover"
                  onClick={() => navigate(`/comics/${comic?._id}`)} />
                <div className="collabCardBody">
                  <h4 className="collabCardComic">{comic?.comicName || "Unknown"}</h4>
                  <p className="collabCardPartner">
                    with <strong>{partner?.name || partner?.email || "—"}</strong>
                    {partner?.role && <span className="collabRoleChip small">{partner.role}</span>}
                  </p>
                  {chat.lastMessage && (
                    <p className="collabCardLastMsg">
                      {chat.lastMessage.type === "system"
                        ? <em>{chat.lastMessage.content}</em>
                        : chat.lastMessage.content?.substring(0, 60)}
                    </p>
                  )}
                  <div className="collabCardMeta">
                    <span className="collabCardStatus" style={{ color: STATUS_COLORS[status] }}>
                      {STATUS_ICONS[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                    {chat.unreadCount > 0 && (
                      <span className="collabCardUnread">{chat.unreadCount} new</span>
                    )}
                  </div>
                </div>
                <button className="btn btn-primary collabCardBtn"
                  onClick={() => navigate(`/collab/${chat._id}`)}>
                  {status === "active" ? "💬 Chat" : "View"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


/* ── Main Profile page ──────────────────────────────────────────────────── */
const Profile = () => {
  const { user, isAuthenticated, loginWithRedirect } = useAuth0();
  const location = useLocation();
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.tab || "bookmarks");

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API}/api/profile/${user.sub}`, { params: { email: user.email } });
      setProfile(res.data);
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (!isAuthenticated) {
    return (
      <div className="profileGate">
        <h2>Sign in to view your profile</h2>
        <button className="btn btn-primary"
          onClick={() => loginWithRedirect({ appState: { returnTo: "/profile" } })}>
          Sign In / Register
        </button>
      </div>
    );
  }

  if (loading) return <ComicLoader message="Loading your profile…" />;
  if (!profile) return <div className="profileGate"><p>Could not load profile.</p></div>;

  const displayName = profile.displayNamePref === "username" && profile.username
    ? profile.username : (user.name || user.email);

  const picUrl = profile.customPicture?.url || user.picture;

  const joinDate = new Date(profile.createdAt).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  const TABS = [
    { id: "bookmarks",       label: "📚 Bookmarks" },
    { id: "likes",           label: "❤️ Liked" },
    { id: "artists",         label: "🎨 Artists" },
    { id: "comments",        label: "💬 Comments" },
    { id: "notifications",   label: "🤝 Requests" },
    { id: "collaborations",  label: "🎭 Collabs" },
    { id: "settings",        label: "⚙️ Settings" },
  ];

  return (
    <div className="profilePage">
      <div className="pageHeading"><h1>My Profile</h1></div>

      <div className="profileHeader">
        <img src={picUrl} alt={user.name} className="profileAvatar headerAvatar" />
        <div className="profileHeaderInfo">
          <h2 className="profileDisplayName">{displayName}</h2>
          {profile.username && <p className="profileUsername">@{profile.username}</p>}
          {profile.bio && <p className="profileBio">{profile.bio}</p>}
          <p className="profileJoinDate">Member since {joinDate}</p>
        </div>
        <div className="profileStats">
          <StatBadge label="Uploaded"   value={profile.stats?.comicsUploaded || 0} />
          <StatBadge label="Liked"      value={profile.stats?.likesCount      || 0} />
          <StatBadge label="Bookmarked" value={profile.stats?.bookmarksCount  || 0} />
          <StatBadge label="Comments"   value={profile.stats?.commentsCount   || 0} />
        </div>
      </div>

      <div className="profileTabBar">
        {TABS.map((t) => (
          <button key={t.id}
            className={`profileTabBtn ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="profileTabContent">
        {activeTab === "bookmarks"      && <BookmarksTab userId={user.sub} />}
        {activeTab === "likes"          && <LikesTab     userId={user.sub} />}
        {activeTab === "artists"        && <ArtistsTab   userId={user.sub} />}
        {activeTab === "comments"       && <CommentsTab  userId={user.sub} />}
        {activeTab === "notifications"  && <NotificationsTab  userEmail={user.email} />}
        {activeTab === "collaborations" && <CollaborationsTab userEmail={user.email} />}
        {activeTab === "settings"       && (
          <SettingsTab userId={user.sub} profile={profile} authUser={user}
            onUpdate={(updated) => setProfile((p) => ({ ...p, ...updated }))} />
        )}
      </div>
    </div>
  );
};

export default Profile;
