import React from "react";
import "./CampusCodeLoader.css";

/*
 * v6.1 — "Charge Up" AI loader (Option A).
 * The three CampusCode logo bars charge in sequence.
 * Props kept identical: fullScreen, text, subtext.
 */

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
        <div className="cc-charge" aria-hidden="true">
          <i className="cc-charge-bar cc-charge-black" />
          <i className="cc-charge-bar cc-charge-purple" />
          <i className="cc-charge-bar cc-charge-lime" />
        </div>

        {text ? <div className="cc-loader-text">{text}</div> : null}
        {subtext ? <div className="cc-loader-subtext">{subtext}</div> : null}
      </div>
    </div>
  );
}
