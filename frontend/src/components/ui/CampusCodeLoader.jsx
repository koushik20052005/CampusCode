import React from "react";
import "./CampusCodeLoader.css";

const ICONS = [
  {
    key: "grid",
    paths: [
      "M8 8h8v8H8z",
      "M8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8zM13 13h3v3h-3z",
    ],
  },
  {
    key: "code",
    paths: [
      "M10 7 6 12l4 5",
      "m14 7 4 5-4 5",
      "m13 6-2 12",
    ],
  },
  {
    key: "bolt",
    paths: ["m13 4-7 9h5l-1 7 7-10h-5z"],
  },
  {
    key: "spark",
    paths: ["M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"],
  },
];

function MorphIcon({ item, index }) {
  return (
    <svg
      className="cc-morph-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ "--cc-icon-index": index }}
    >
      {item.paths.map((d, pathIndex) => (
        <path
          key={`${item.key}-${pathIndex}`}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export default function CampusCodeLoader({
  fullScreen = false,
  text = "Loading",
  subtext = "Syncing CampusCode",
}) {
  return (
    <div
      className={`campus-loader ${
        fullScreen ? "campus-loader-fullscreen" : "campus-loader-inline"
      }`}
    >
      <div
        className="cc-loader-core"
        role="status"
        aria-live="polite"
        aria-label={text || "Loading"}
      >
        <div className="cc-morph-stage" aria-hidden="true">
          <span className="cc-morph-ring ring-one" />
          <span className="cc-morph-ring ring-two" />

          <div className="cc-morph-tile">
            <span className="cc-morph-highlight" />

            <div className="cc-morph-icons">
              {ICONS.map((item, index) => (
                <MorphIcon item={item} index={index} key={item.key} />
              ))}
            </div>
          </div>

          <span className="cc-morph-dot dot-one" />
          <span className="cc-morph-dot dot-two" />
          <span className="cc-morph-dot dot-three" />
        </div>

        {text ? <div className="cc-loader-text">{text}</div> : null}
        {subtext ? <div className="cc-loader-subtext">{subtext}</div> : null}
      </div>
    </div>
  );
}
