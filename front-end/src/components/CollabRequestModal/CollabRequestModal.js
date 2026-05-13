import "./CollabRequestModal.css";
import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";

const API = process.env.REACT_APP_URL;

const ROLES = [
  { id: "writer",    label: "✍️ Writer",    desc: "Story, script & dialogue" },
  { id: "artist",    label: "🎨 Artist",    desc: "Pencils & inking" },
  { id: "colorist",  label: "🖌️ Colorist",  desc: "Color & shading" },
  { id: "letterer",  label: "🔤 Letterer",  desc: "Fonts, speech bubbles & SFX" },
  { id: "editor",    label: "📝 Editor",    desc: "Story feedback & polish" },
  { id: "other",     label: "💡 Other",     desc: "Something else entirely" },
];

const CollabRequestModal = ({ comic, onClose, onSent }) => {
  const { user } = useAuth0();
  const [role,          setRole]          = useState("");
  const [pitch,         setPitch]         = useState("");
  const [portfolioUrl,  setPortfolioUrl]  = useState("");
  const [scopeAll,      setScopeAll]      = useState(true);
  const [scopeChapters, setScopeChapters] = useState("");
  const [sending,       setSending]       = useState(false);
  const [error,         setError]         = useState("");

  const handleSubmit = async () => {
    if (!role)         return setError("Please choose a role.");
    if (!pitch.trim()) return setError("A short pitch is required.");

    setSending(true);
    setError("");
    try {
      const chapterScope = scopeAll
        ? { all: true, chapters: [] }
        : {
            all: false,
            chapters: scopeChapters
              .split(",")
              .map((s) => parseInt(s.trim()))
              .filter((n) => !isNaN(n)),
          };

      await axios.post(`${API}/api/collab/request`, {
        comicId:       comic._id,
        requesterId:   user.sub,
        requesterEmail:user.email,
        requesterName: user.name || user.email,
        requesterPic:  user.picture || "",
        role,
        pitch: pitch.trim(),
        portfolioUrl: portfolioUrl.trim(),
        chapterScope,
      });

      onSent();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send request. Try again.");
    }
    setSending(false);
  };

  return (
    <div className="crModalOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="crModal">
        <button className="crClose" onClick={onClose}>✕</button>

        {/* Comic context strip */}
        <div className="crComicStrip">
          <img src={comic.coverImage?.url} alt={comic.comicName} className="crCover" />
          <div>
            <p className="crComicLabel">Requesting to collab on</p>
            <h3 className="crComicName">{comic.comicName}</h3>
            <p className="crAuthor">by {comic.authorName || "Anonymous"}</p>
          </div>
        </div>

        <h2 className="crHeading">What would you bring?</h2>
        <p className="crSubheading">
          Choose your role and pitch yourself — the creator will see exactly this before deciding.
        </p>

        {/* Role selector */}
        <div className="crRoleGrid">
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={`crRoleBtn ${role === r.id ? "selected" : ""}`}
              onClick={() => setRole(r.id)}
            >
              <span className="crRoleLabel">{r.label}</span>
              <span className="crRoleDesc">{r.desc}</span>
            </button>
          ))}
        </div>

        {/* Pitch */}
        <div className="crField">
          <label className="crLabel">
            Your pitch <span className="crRequired">*</span>
          </label>
          <textarea
            className="crTextarea"
            placeholder="Tell the creator what you bring, your style, and why this comic excites you… (max 300 chars)"
            value={pitch}
            onChange={(e) => setPitch(e.target.value.slice(0, 300))}
            rows={4}
          />
          <span className="crCharCount">{pitch.length}/300</span>
        </div>

        {/* Portfolio */}
        <div className="crField">
          <label className="crLabel">Portfolio link <span className="crOptional">(optional)</span></label>
          <input
            className="crInput"
            type="url"
            placeholder="https://your-portfolio.com"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
          />
        </div>

        {/* Chapter scope */}
        <div className="crField">
          <label className="crLabel">Chapter scope</label>
          <div className="crScopeRow">
            <label className={`crScopeOption ${scopeAll ? "selected" : ""}`}>
              <input type="radio" checked={scopeAll} onChange={() => setScopeAll(true)} />
              All chapters
            </label>
            <label className={`crScopeOption ${!scopeAll ? "selected" : ""}`}>
              <input type="radio" checked={!scopeAll} onChange={() => setScopeAll(false)} />
              Specific chapters
            </label>
          </div>
          {!scopeAll && (
            <input
              className="crInput"
              type="text"
              placeholder="e.g. 2, 3, 5"
              value={scopeChapters}
              onChange={(e) => setScopeChapters(e.target.value)}
            />
          )}
        </div>

        {error && <p className="crError">{error}</p>}

        <div className="crActions">
          <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={sending || !role}>
            {sending ? "Sending…" : "Send Request 🤝"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollabRequestModal;
