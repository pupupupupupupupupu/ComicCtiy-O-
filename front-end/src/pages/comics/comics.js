import "./comics.css";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import ComicLoader from "../../components/ComicLoader";
import ComicCard from "../../components/ComicCard/ComicCard";

const BASE_URL = `${process.env.REACT_APP_URL}/api/comics`;

const Comics = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const genreFilter = searchParams.get("genre") || "";

  const [comics, setComics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    setPage(1);
    setComics([]);
  }, [genreFilter]);

  useEffect(() => {
    const fetchComics = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page, limit: 20, sort: "recent" });
        if (genreFilter) params.set("genre", genreFilter);
        const res = await axios.get(`${BASE_URL}?${params}`);
        setComics(res.data.comics || []);
        setPagination(res.data.pagination || {});
      } catch {
        setError("Couldn't load comics. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    fetchComics();
  }, [page, genreFilter]);

  return (
    <div className="comicsPage">
      <div className="pageHeading">
        <h1>{genreFilter ? `${genreFilter} Comics` : "All Comics"}</h1>
      </div>

      {loading ? (
        <ComicLoader message="Flipping through the archives…" />
      ) : error ? (
        <div className="errorMsg">{error}</div>
      ) : (
        <>
          {comics.length === 0 ? (
            <div className="emptyState">
              <p>No comics found{genreFilter ? ` for "${genreFilter}"` : ""}.</p>
            </div>
          ) : (
            <div className="comicGrid">
              {comics.map((comic) => (
                <ComicCard key={comic._id} comic={comic} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-primary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className="pageInfo">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                className="btn btn-primary"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Comics;
