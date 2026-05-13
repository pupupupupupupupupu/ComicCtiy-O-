import "./upload.css";
import { useState, useRef, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ComicLoader from "./ComicLoader";

const API_URL    = `${process.env.REACT_APP_URL}/api/comics`;
const CLD_NAME   = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const CLD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
const CLD_UPLOAD = `https://api.cloudinary.com/v1_1/${CLD_NAME}/image/upload`;

const GENRES = [
  "Action","Adventure","Comedy","Drama","Fantasy",
  "Horror","Mystery","Romance","Sci-Fi","Slice of Life",
  "Sports","Supernatural","Thriller",
];

const uploadToCloudinary = async (file, folder) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLD_PRESET);
  fd.append("folder", folder);
  const res = await fetch(CLD_UPLOAD, { method: "POST", body: fd });
  if (!res.ok) {
    let detail = res.statusText;
    try { const b = await res.json(); detail = b?.error?.message || detail; } catch {}
    if (res.status === 400 && detail.toLowerCase().includes("upload preset")) {
      throw new Error(
        `Cloudinary preset "${CLD_PRESET}" not found or not Unsigned. ` +
        `Go to Cloudinary → Settings → Upload → Upload Presets → create an unsigned preset named "${CLD_PRESET}".`
      );
    }
    throw new Error(`Cloudinary upload failed (${res.status}): ${detail}`);
  }
  return res.json();
};

const Toast = ({ msg, type }) =>
  msg ? <div className={`toast toast-${type}`}>{msg}</div> : null;

const ProgressBar = ({ value, total, label }) => (
  <div className="uploadProgress">
    <p className="progressLabel">{label}</p>
    <div className="progressTrack">
      <div className="progressFill" style={{ width: total ? `${Math.round((value/total)*100)}%` : "0%" }} />
    </div>
    <span className="progressPct">{total ? Math.round((value/total)*100) : 0}%</span>
  </div>
);

// ── Drag-to-reorder page list ──────────────────────────────────────────────
const PageReorder = ({ pages, onReorder, onRemove }) => {
  const dragItem    = useRef(null);
  const dragOverItem = useRef(null);

  const handleDragStart = (i) => { dragItem.current = i; };
  const handleDragEnter = (i) => { dragOverItem.current = i; };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const reordered = [...pages];
    const dragged   = reordered.splice(dragItem.current, 1)[0];
    reordered.splice(dragOverItem.current, 0, dragged);

    dragItem.current    = null;
    dragOverItem.current = null;
    onReorder(reordered);
  };

  if (!pages.length) return null;

  return (
    <div className="pageReorderGrid">
      {pages.map((page, i) => (
        <div
          key={page.id}
          className="pageReorderItem"
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragEnter={() => handleDragEnter(i)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => e.preventDefault()}
          title="Drag to reorder"
        >
          <div className="pageNumber">#{i + 1}</div>
          <img src={page.preview} alt={`Page ${i + 1}`} className="reorderThumb" />
          <div className="pageFileName">{page.file.name}</div>
          <button
            type="button"
            className="pageRemoveBtn"
            onClick={() => onRemove(i)}
            aria-label="Remove page"
          >
            ✕
          </button>
          <div className="dragHandle" title="Drag to reorder">⠿</div>
        </div>
      ))}
    </div>
  );
};

// ── Main Upload component ──────────────────────────────────────────────────
const Upload = () => {
  const { user, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    comicName: "", authorName: "", chapterNumber: "",
    totalChapter: "", description: "", genre: [],
  });

  const [coverFile,       setCoverFile]       = useState(null);
  const [coverPreview,    setCoverPreview]    = useState(null);
  const [carouselFile,    setCarouselFile]    = useState(null);
  const [carouselPreview, setCarouselPreview] = useState(null);

  // Each page is { id, file, preview } — id is stable across reorders
  const [pages, setPages] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress,     setProgress]     = useState({ done: 0, total: 0, label: "" });
  const [toast,        setToast]        = useState({ msg: "", type: "success" });

  const idCounter = useRef(0);
  const nextId    = () => { idCounter.current += 1; return idCounter.current; };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 6000);
  };

  const handleField  = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const handleGenre  = (g) => setForm((f) => ({
    ...f,
    genre: f.genre.includes(g) ? f.genre.filter((x) => x !== g) : [...f.genre, g],
  }));

  const handleCoverChange    = (e) => {
    const f = e.target.files[0];
    if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); }
  };
  const handleCarouselChange = (e) => {
    const f = e.target.files[0];
    if (f) { setCarouselFile(f); setCarouselPreview(URL.createObjectURL(f)); }
  };

  // Adding pages: append to existing list (user can call multiple times)
  const handlePageFiles = (e) => {
    const newFiles = Array.from(e.target.files);
    const newPages = newFiles.map((file) => ({
      id:      nextId(),
      file,
      preview: URL.createObjectURL(file),
    }));
    setPages((prev) => [...prev, ...newPages]);
    // Reset input so same files can be re-added if needed
    e.target.value = "";
  };

  const handleReorder = useCallback((reordered) => setPages(reordered), []);
  const handleRemove  = useCallback((idx) => setPages((p) => p.filter((_, i) => i !== idx)), []);
  const clearPages    = () => setPages([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      loginWithRedirect({ appState: { returnTo: "/upload" } });
      return;
    }

    if (!coverFile)              return showToast("Please select a cover image.", "error");
    if (!form.comicName.trim())  return showToast("Comic name is required.", "error");
    if (!form.description.trim())return showToast("Description is required.", "error");
    if (!form.chapterNumber)     return showToast("Chapter number is required.", "error");
    if (form.genre.length === 0) return showToast("Select at least one genre.", "error");
    if (!CLD_NAME || !CLD_PRESET)
      return showToast(
        "Cloudinary not configured. Check REACT_APP_CLOUDINARY_CLOUD_NAME and REACT_APP_CLOUDINARY_UPLOAD_PRESET in .env",
        "error"
      );

    setIsSubmitting(true);
    try {
      const totalUploads = 1 + (carouselFile ? 1 : 0) + pages.length;
      let done = 0;
      const tick = (label) => { done++; setProgress({ done, total: totalUploads, label }); };

      // Cover
      setProgress({ done: 0, total: totalUploads, label: "Uploading cover image…" });
      const coverResult = await uploadToCloudinary(coverFile, "comic-city/covers");
      tick("Cover uploaded ✓");

      // Carousel (optional)
      let carouselResult = null;
      if (carouselFile) {
        setProgress((p) => ({ ...p, label: "Uploading carousel image…" }));
        carouselResult = await uploadToCloudinary(carouselFile, "comic-city/carousel");
        tick("Carousel uploaded ✓");
      }

      // Pages — upload in the exact order shown in the UI
      const uploadedPages = [];
      for (let i = 0; i < pages.length; i++) {
        setProgress((p) => ({ ...p, label: `Uploading page ${i + 1} of ${pages.length}…` }));
        const result = await uploadToCloudinary(pages[i].file, "comic-city/pages");
        uploadedPages.push({ public_id: result.public_id, url: result.secure_url });
        tick(`Page ${i + 1} uploaded ✓`);
      }

      // Save to backend
      setProgress((p) => ({ ...p, label: "Saving to database…" }));
      await axios.post(API_URL, {
        comicName:     form.comicName.trim(),
        authorName:    form.authorName.trim(),
        chapterNumber: Number(form.chapterNumber),
        totalChapter:  form.totalChapter ? Number(form.totalChapter) : undefined,
        description:   form.description.trim(),
        genre:         form.genre,
        email:         user.email,
        coverImage:    { public_id: coverResult.public_id,    url: coverResult.secure_url },
        carouselImage: carouselResult
          ? { public_id: carouselResult.public_id, url: carouselResult.secure_url }
          : { public_id: null, url: null },
        comicImages: uploadedPages,
      });

      showToast("Comic uploaded successfully! 🎉", "success");
      setTimeout(() => navigate("/comics"), 1600);
    } catch (err) {
      showToast(err.response?.data?.error || err.message || "Upload failed.", "error");
    } finally {
      setIsSubmitting(false);
      setProgress({ done: 0, total: 0, label: "" });
    }
  };

  if (!user) {
    return (
      <div className="uploadGate">
        <h2>Sign in to upload your comics</h2>
        <p>Join Comic City and share your stories with the world.</p>
        <button className="btn btn-primary"
          onClick={() => loginWithRedirect({ appState: { returnTo: "/upload" } })}>
          Sign In / Register
        </button>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="uploadingState">
        <ComicLoader message={progress.label || "Uploading your masterpiece…"} />
        <ProgressBar value={progress.done} total={progress.total} label={progress.label} />
      </div>
    );
  }

  return (
    <div className="uploadPage">
      <div className="pageHeading"><h1>Upload Comic</h1></div>
      <Toast msg={toast.msg} type={toast.type} />

      <form className="uploadForm" onSubmit={handleSubmit}>

        {/* Cover */}
        <div className="formGroup">
          <label className="formLabel">Cover Image *</label>
          <div className="fileDropZone">
            {coverPreview
              ? <img src={coverPreview} alt="Cover preview" className="filePreview coverPreview" />
              : <span>Click or drag to upload cover</span>}
            <input type="file" accept="image/*" onChange={handleCoverChange} />
          </div>
        </div>

        {/* Carousel */}
        <div className="formGroup">
          <label className="formLabel">
            Carousel Image <span className="optional">(optional — shown on home page banner)</span>
          </label>
          <div className="fileDropZone">
            {carouselPreview
              ? <img src={carouselPreview} alt="Carousel preview" className="filePreview" />
              : <span>Click or drag to upload carousel image</span>}
            <input type="file" accept="image/*" onChange={handleCarouselChange} />
          </div>
        </div>

        {/* Comic Name */}
        <div className="formGroup">
          <label className="formLabel">Comic Name *</label>
          <input className="formInput" type="text" name="comicName"
            value={form.comicName} onChange={handleField} placeholder="e.g. The Dark Chronicles" />
        </div>

        {/* Author */}
        <div className="formGroup">
          <label className="formLabel">Author Name</label>
          <input className="formInput" type="text" name="authorName"
            value={form.authorName} onChange={handleField} placeholder="Your name or pen name" />
        </div>

        {/* Chapters */}
        <div className="formRow">
          <div className="formGroup">
            <label className="formLabel">Chapter Number *</label>
            <input className="formInput" type="number" name="chapterNumber"
              value={form.chapterNumber} onChange={handleField} min="1" />
          </div>
          <div className="formGroup">
            <label className="formLabel">Total Chapters</label>
            <input className="formInput" type="number" name="totalChapter"
              value={form.totalChapter} onChange={handleField} min="1" />
          </div>
        </div>

        {/* Description */}
        <div className="formGroup">
          <label className="formLabel">Description *</label>
          <textarea className="formInput formTextarea" name="description"
            value={form.description} onChange={handleField}
            placeholder="What's this comic about?" rows={4} />
        </div>

        {/* Genre */}
        <div className="formGroup">
          <label className="formLabel">Genre * (select all that apply)</label>
          <div className="genreGrid">
            {GENRES.map((g) => (
              <label key={g} className={`genreChip ${form.genre.includes(g) ? "selected" : ""}`}>
                <input type="checkbox" checked={form.genre.includes(g)} onChange={() => handleGenre(g)} />
                {g}
              </label>
            ))}
          </div>
        </div>

        {/* Comic Pages with drag-to-reorder */}
        <div className="formGroup">
          <label className="formLabel">
            Comic Pages
            {pages.length > 0 && (
              <span className="optional"> — drag thumbnails to reorder, ✕ to remove</span>
            )}
          </label>

          {/* Add pages button — can be clicked multiple times to add more */}
          <div className="fileDropZone addPagesZone">
            <span>
              {pages.length === 0
                ? "Click or drag to select pages"
                : `Add more pages (${pages.length} selected)`}
            </span>
            <input type="file" accept="image/*" multiple onChange={handlePageFiles} />
          </div>

          {pages.length > 0 && (
            <>
              <div className="pagesToolbar">
                <span className="fileCount">{pages.length} page(s) — drag to reorder</span>
                <button type="button" className="clearPagesBtn" onClick={clearPages}>
                  Clear all
                </button>
              </div>
              <PageReorder
                pages={pages}
                onReorder={handleReorder}
                onRemove={handleRemove}
              />
            </>
          )}
        </div>

        <button type="submit" className="btn btn-primary submitBtn">
          Upload Comic
        </button>
      </form>
    </div>
  );
};

export default Upload;
