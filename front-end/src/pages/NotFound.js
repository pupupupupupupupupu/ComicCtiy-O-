import { Link } from "react-router-dom";
import "./NotFound.css";

const NotFound = () => (
  <div className="notFound">
    <div className="notFoundInner">
      <div className="notFoundPanel">404</div>
      <h2>Page Not Found</h2>
      <p>This issue doesn't exist in our archives.</p>
      <Link to="/" className="btn btn-primary">
        Back to Home
      </Link>
    </div>
  </div>
);

export default NotFound;
