import { useState } from "react";
import { RefreshCw } from "lucide-react";
import "./CampusCodeRefresh.css";

export default function CampusCodeRefresh({ onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;

    setRefreshing(true);

    try {
      await Promise.resolve(onRefresh?.());
    } finally {
      window.setTimeout(() => setRefreshing(false), 650);
    }
  };

  return (
    <button
      type="button"
      className={`campus-refresh-button ${refreshing ? "is-refreshing" : ""}`}
      onClick={handleRefresh}
      disabled={refreshing}
      aria-label="Refresh current page"
      title="Refresh current page"
    >
      <span className="campus-refresh-icon-wrap">
        <RefreshCw className="campus-refresh-icon" size={16} strokeWidth={1.9} />
      </span>
      <span className="campus-refresh-label">REFRESH</span>
    </button>
  );
}
