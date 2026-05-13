import { useNavigate } from "react-router-dom";
import QuickSave from "../QuickSave/QuickSave";
import "./ComicCard.css";

// Shared comic card used on home, comics, popular, search results pages.
// Shows QuickSave (like/bookmark) buttons on hover — NOT shown on the
// selectedComic detail page which has its own full LikeBookmark bar.
const ComicCard = ({ comic, showQuickSave = true }) => {
  const navigate = useNavigate();
  const genre = Array.isArray(comic.genre) ? comic.genre[0] : comic.genre;

  return (
    <div
      className="comicCard"
      onClick={() => navigate(`/comics/${comic._id}`, { state: comic })}
      title={comic.comicName}
    >
      <div className="comicCardImageWrap">
        <img
          src={comic.coverImage?.url}
          alt={comic.comicName}
          loading="lazy"
          className="comicCardImage"
        />
        {showQuickSave && (
          <QuickSave comicId={String(comic._id)} />
        )}
      </div>
      <div className="cardInfo">
        <h3>{comic.comicName}</h3>
        {genre && <p>{genre}</p>}
      </div>
    </div>
  );
};

export default ComicCard;
