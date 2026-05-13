import { useState } from "react";
import axios from "axios";
import "./AddChapterModal.css";

const BASE_URL   = `${process.env.REACT_APP_URL}/api/comics`;
const CLD_NAME   = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const CLD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
const CLD_UPLOAD = `https://api.cloudinary.com/v1_1/${CLD_NAME}/image/upload`;

const uploadToCloudinary = async (file, folder) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLD_PRESET);
  fd.append("folder", folder);
  const res = await fetch(CLD_UPLOAD, { method: "POST", body: fd });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b?.error?.message || `Upload failed (${res.status})`);
  }
  return res.json();
};

const idCounter = { v: 0 };
const nextId    = () => { idCounter.v++; return idCounter.v; };

// Drag-to-reorder grid (same pattern as upload page)
const PageReorder = ({ pages, onReorder, onRemove }) => {
  const dragItem     = { current: null };
  const dragOverItem = { current: null };

  const onDragStart = (i)  => { dragItem.current = i; };
  const onDragEnter = (i)  => { dragOverItem.current = i; };
  const onDragEnd   = ()   => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    const arr     = [...pages];
    const dragged = arr.splice(dragItem.current, 1)[0];
    arr.splice(dragOverItem.current, 0, dragged);
    dragItem.current     = null;
    dragOverItem.current = null;
    onReorder(arr);
  };

  return (
    <div className="acmPageGrid">
      {pages.map((p, i) => (
        <div key={p.id} className="acmPageItem"
          draggable
          onDragStart={() => onDragStart(i)}
          onDragEnter={() => onDragEnter(i)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => e.preventDefault()}
        >
          <span className="acmPageNum">#{i + 1}</span>
          <img src={p.preview} alt={`p${i + 1}`} className="acmPageThumb" />
          <button type="button" className="acmPageRemove" onClick={() => onRemove(i)}>✕</button>
        </div>
      ))}
    </div>
  );
};

const AddChapterModal = ({ comicId, existingNumbers, userEmail, onAdded, onClose }) => {
  const [chapterNumber, setChapterNumber] = useState("");
  const [title,         setTitle]         = useState("");
  const [pages,         setPages]         = useState([]);
  const [isUploading,   setIsUploading]   = useState(false);
  const [progress,      setProgress]      = useState({ done: 0, total: 0, label: "" });
  const [error,         setError]         = useState("");

  const handlePageFiles = (e) => {
    const files = Array.from(e.target.files);
    setPages((prev) => [
      ...prev,
      ...files.map((f) => ({ id: nextId(), file: f, preview: URL.createObjectURL(f) })),
    ]);
    e.target.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const num = Number(chapterNumber);
    if (!num || num < 1)
      return setError("Enter a valid chapter number.");
    if (existingNumbers.includes(num))
      return setError(`Chapter ${num} already exists.`);
    if (pages.length === 0)
      return setError("Add at least one page.");

    setIsUploading(true);
    try {
      const uploadedPages = [];
      for (let i = 0; i < pages.length; i++) {
        setProgress({ done: i, total: pages.length, label: `Uploading page ${i + 1} of ${pages.length}…` });
        const result = await uploadToCloudinary(pages[i].file, "comic-city/pages");
        uploadedPages.push({ public_id: result.public_id, url: result.secure_url });
      }
      setProgress({ done: pages.length, total: pages.length, label: "Saving…" });

      const res = await axios.post(`${BASE_URL}/${comicId}/chapters`, {
        email:         userEmail,
        chapterNumber: num,
        title:         title.trim(),
        comicImages:   uploadedPages,
      });
      onAdded(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
      setProgress({ done: 0, total: 0, label: "" });
    }
  };

  return (
    <div className="acmOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="acmModal">
        <div className="acmHeader">
          <h2>Add New Chapter</h2>
          <button className="acmClose" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {isUploading ? (
          <div className="acmUploading">
            <p className="acmProgressLabel">{progress.label}</p>
            <div className="acmProgressTrack">
              <div className="acmProgressFill"
                style={{ width: progress.total ? `${Math.round((progress.done/progress.total)*100)}%` : "0%" }}
              />
            </div>
            <span className="acmProgressPct">
              {progress.total ? Math.round((progress.done/progress.total)*100) : 0}%
            </span>
          </div>
        ) : (
          <form className="acmForm" onSubmit={handleSubmit}>
            {error && <div className="acmError">{error}</div>}

            <div className="acmRow">
              <div className="acmGroup">
                <label className="acmLabel">Chapter Number *</label>
                <input className="acmInput" type="number" min="1"
                  value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)}
                  placeholder="e.g. 2" />
              </div>
              <div className="acmGroup" style={{ flex: 2 }}>
                <label className="acmLabel">Chapter Title <span className="acmOptional">(optional)</span></label>
                <input className="acmInput" type="text"
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. The Beginning" />
              </div>
            </div>

            <div className="acmGroup">
              <label className="acmLabel">Pages *
                {pages.length > 0 && <span className="acmOptional"> — drag to reorder, ✕ to remove</span>}
              </label>
              <div className="acmDropZone">
                <span>{pages.length === 0 ? "Click or drag to select pages" : `Add more pages`}</span>
                <input type="file" accept="image/*" multiple onChange={handlePageFiles} />
              </div>
              {pages.length > 0 && (
                <>
                  <div className="acmPagesToolbar">
                    <span className="acmPageCount">{pages.length} page(s)</span>
                    <button type="button" className="acmClearPages" onClick={() => setPages([])}>Clear all</button>
                  </div>
                  <PageReorder
                    pages={pages}
                    onReorder={setPages}
                    onRemove={(i) => setPages((p) => p.filter((_, idx) => idx !== i))}
                  />
                </>
              )}
            </div>

            <div className="acmActions">
              <button type="button" className="btn" onClick={onClose}
                style={{ background: "#eee", color: "#555" }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Upload Chapter
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddChapterModal;
