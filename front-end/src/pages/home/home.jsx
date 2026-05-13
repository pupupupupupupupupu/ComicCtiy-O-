import "./home.css";
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import ComicLoader from "../../components/ComicLoader";
import ComicCard from "../../components/ComicCard/ComicCard";
import { useGlobalContext } from "../../Context";

const BASE_URL = `${process.env.REACT_APP_URL}/api/comics`;


/* ── Carousel ───────────────────────────────────────────────────────────── */
const Carousel = ({ slides }) => {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slides.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;
  const slide = slides[idx];

  return (
    <div className="carousel">
      <div
        className="carouselInner"
        style={{ backgroundImage: `url(${slide.url})` }}
        onClick={() => navigate(`/comics/${slide.comicId}`)}
      >
        <div className="carouselOverlay">
          <h2 className="carouselTitle">{slide.comicName}</h2>
          <span className="carouselCta">Read Now →</span>
        </div>
      </div>
      <div className="carouselDots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`dot ${i === idx ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setIdx(i); }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

/* ── Section strip ──────────────────────────────────────────────────────── */
const ComicStrip = ({ title, comics, linkTo, linkLabel }) => (
  <section className="homeSection">
    <div className="sectionHeader">
      <h2 className="sectionTitle">{title}</h2>
      {linkTo && (
        <Link to={linkTo} className="sectionLink">{linkLabel || "See all →"}</Link>
      )}
    </div>
    <div className="comicStrip">
      {comics.map((c) => <ComicCard key={c._id} comic={c} />)}
    </div>
  </section>
);

/* ── Genre browse ───────────────────────────────────────────────────────── */
const GenreBrowse = ({ genres }) => {
  const navigate = useNavigate();
  if (!genres.length) return null;
  return (
    <section className="homeSection">
      <h2 className="sectionTitle">Browse by Genre</h2>
      <div className="genrePills">
        {genres.map((g) => (
          <button
            key={g}
            className="genrePill"
            onClick={() => navigate(`/comics?genre=${encodeURIComponent(g)}`)}
          >
            {g}
          </button>
        ))}
      </div>
    </section>
  );
};

/* ── Search results view ────────────────────────────────────────────────── */
const SearchResults = ({ results, onClear }) => (
  <div className="searchResultsView">
    {/* Banner with dismiss */}
    <div className="searchResultsBanner">
      <div className="searchResultsMeta">
        <span className="searchResultsIcon">🔍</span>
        <span>
          <strong>{results.length}</strong> result{results.length !== 1 ? "s" : ""} found
        </span>
      </div>
      <button className="clearResultsBtn" onClick={onClear}>
        ✕ Clear results
      </button>
    </div>

    {results.length === 0 ? (
      <div className="noResults">
        <p>No comics matched your search.</p>
        <button className="btn btn-primary" onClick={onClear} style={{ marginTop: "1rem" }}>
          Back to Home
        </button>
      </div>
    ) : (
      <div className="comicGrid" style={{ padding: "1.5rem 2rem" }}>
        {results.map((c) => <ComicCard key={c._id} comic={c} />)}
      </div>
    )}
  </div>
);

/* ── Home page ──────────────────────────────────────────────────────────── */
const HomePage = () => {
  const { searchResults, setSearchResults } = useGlobalContext();
  const [carousel, setCarousel] = useState([]);
  const [popular,  setPopular]  = useState([]);
  const [recent,   setRecent]   = useState([]);
  const [genres,   setGenres]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [carouselRes, popularRes, recentRes, genreRes] = await Promise.all([
        axios.get(`${BASE_URL}/carousel`),
        axios.get(`${BASE_URL}?sort=weekly&limit=6`),
        axios.get(`${BASE_URL}?sort=recent&limit=6`),
        axios.get(`${BASE_URL}/genres`),
      ]);
      setCarousel(carouselRes.data || []);
      setPopular(popularRes.data.comics   || []);
      setRecent(recentRes.data.comics     || []);
      setGenres(genreRes.data             || []);
    } catch {
      setError("Couldn't load comics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const clearSearch = useCallback(() => setSearchResults([]), [setSearchResults]);

  // Show search results overlay if active
  if (searchResults.length > 0) {
    return <SearchResults results={searchResults} onClear={clearSearch} />;
  }

  // Show empty search state (searched but no matches)
  // This is distinguished from initial load: searchResults is [] but we know a
  // search was attempted. We don't track this separately — navbar clears on
  // route change so "no results" only shows within the same page session.

  if (loading) return <ComicLoader message="Assembling the universe…" />;
  if (error)   return <div className="errorMsg">{error}</div>;

  return (
    <div className="homePage">
      <Carousel slides={carousel} />

      {popular.length > 0 && (
        <ComicStrip
          title="🔥 Popular This Week"
          comics={popular}
          linkTo="/popular"
          linkLabel="See all →"
        />
      )}

      {recent.length > 0 && (
        <ComicStrip
          title="🆕 Recent Uploads"
          comics={recent}
          linkTo="/comics"
          linkLabel="Browse all →"
        />
      )}

      <GenreBrowse genres={genres} />
    </div>
  );
};

export default HomePage;
