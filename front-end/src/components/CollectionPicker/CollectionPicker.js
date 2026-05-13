import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./CollectionPicker.css";

const API = process.env.REACT_APP_URL;

const CollectionPicker = ({ userId, comicId, currentColIds, onClose, onChange }) => {
  const [collections,   setCollections]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [newColName,    setNewColName]    = useState("");
  const [creating,      setCreating]      = useState(false);
  const [toggling,      setToggling]      = useState({});
  const [error,         setError]         = useState("");
  const panelRef = useRef(null);

  // Track which collections this comic is currently in (local copy for instant UI)
  const [activeColIds, setActiveColIds] = useState(new Set(currentColIds));

  useEffect(() => {
    axios.get(`${API}/api/collections/${userId}`)
      .then((res) => setCollections(res.data))
      .catch(() => setError("Couldn't load collections."))
      .finally(() => setLoading(false));
  }, [userId]);

  // Click outside closes
  useEffect(() => {
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const toggleCollection = async (col) => {
    setToggling((t) => ({ ...t, [col._id]: true }));
    const isIn = activeColIds.has(String(col._id));
    try {
      if (isIn) {
        await axios.delete(`${API}/api/bookmarks`, {
          data: { userId, comicId, collectionId: col._id },
        });
        setActiveColIds((prev) => { const s = new Set(prev); s.delete(String(col._id)); return s; });
      } else {
        await axios.post(`${API}/api/bookmarks`, { userId, comicId, collectionId: col._id });
        setActiveColIds((prev) => new Set([...prev, String(col._id)]));
      }
    } catch (err) {
      setError(err.response?.data?.error || "Action failed.");
    } finally {
      setToggling((t) => ({ ...t, [col._id]: false }));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await axios.post(`${API}/api/collections`, { userId, name: newColName.trim() });
      setCollections((prev) => [...prev, res.data]);
      setNewColName("");
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't create collection.");
    } finally {
      setCreating(false);
    }
  };

  // Propagate final state up when closing
  const handleClose = () => {
    const newColIds = [...activeColIds];
    onChange(newColIds.length > 0, newColIds);
    onClose();
  };

  return (
    <div className="cpOverlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="cpPanel" ref={panelRef}>
        <div className="cpHeader">
          <h3>Save to Collection</h3>
          <button className="cpClose" onClick={handleClose}>✕</button>
        </div>

        {error && <div className="cpError">{error}</div>}

        {/* Collection list */}
        <div className="cpList">
          {loading ? (
            <div className="cpLoading">Loading…</div>
          ) : (
            collections.map((col) => {
              const isIn = activeColIds.has(String(col._id));
              return (
                <button
                  key={col._id}
                  className={`cpColItem ${isIn ? "saved" : ""}`}
                  onClick={() => toggleCollection(col)}
                  disabled={toggling[col._id]}
                >
                  <span className="cpColIcon">{isIn ? "🔖" : "📁"}</span>
                  <span className="cpColName">{col.name}</span>
                  {col.isDefault && <span className="cpDefault">Default</span>}
                  <span className="cpColCount">{col.comicCount || 0}</span>
                  {isIn && <span className="cpSavedBadge">✓</span>}
                </button>
              );
            })
          )}
        </div>

        {/* Create new collection */}
        <form className="cpCreateForm" onSubmit={handleCreate}>
          <input
            className="cpInput"
            type="text"
            placeholder="New collection name…"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            maxLength={60}
          />
          <button type="submit" className="btn btn-primary cpCreateBtn" disabled={creating || !newColName.trim()}>
            {creating ? "…" : "+ Create"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CollectionPicker;
