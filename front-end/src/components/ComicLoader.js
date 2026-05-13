import React from "react";
import "./ComicLoader.css";

const ComicLoader = ({ message = "Loading issues..." }) => (
  <div className="comicLoader">
    <div className="panelGrid">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="panel"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
    <p className="loaderText">{message}</p>
  </div>
);

export default ComicLoader;
