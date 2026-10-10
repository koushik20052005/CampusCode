import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "./api";
import "./notifications.css";

/*
 * v6 — real-time notifications.
 * Connects to the SSE stream (/api/notifications/stream) and falls back
 * to polling the unread count if the stream is unavailable.
 */

export function useLiveNotifications() {
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState([]);
  const unreadRef = useRef(0);
  const seenRef = useRef(new Set());

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return undefined;

    let es = null;
    let pollTimer = null;
    let disposed = false;

    const pushToast = (item) => {
      if (!item || seenRef.current.has(item.id)) return;
      seenRef.current.add(item.id);
      const toastId = `${item.id}-${Date.now()}`;
      setToasts((t) => [...t.slice(-2), { ...item, toastId }]);
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.toastId !== toastId));
      }, 6500);
    };

    const handlePayload = (data) => {
      if (!data || typeof data.unread_count !== "number") return;
      if (data.unread_count > unreadRef.current && Array.isArray(data.items)) {
        data.items.forEach(pushToast);
      }
      unreadRef.current = data.unread_count;
      setUnread(data.unread_count);
    };

    const startPolling = () => {
      const fetchCount = async () => {
        if (disposed) return;
        try {
          const r = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const j = await r.json();
          handlePayload({ unread_count: j.unread_count ?? j.count ?? 0 });
        } catch {
          /* stay silent — retry on next tick */
        }
      };
      fetchCount();
      pollTimer = setInterval(fetchCount, 30000);
    };

    try {
      es = new EventSource(
        `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`
      );
      es.addEventListener("notifications", (e) => {
        try { handlePayload(JSON.parse(e.data)); } catch { /* ignore */ }
      });
      es.addEventListener("ping", (e) => {
        try { handlePayload(JSON.parse(e.data)); } catch { /* ignore */ }
      });
      es.onerror = () => {
        try { es.close(); } catch { /* ignore */ }
        es = null;
        if (!disposed && !pollTimer) startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      disposed = true;
      try { es && es.close(); } catch { /* ignore */ }
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const clearBadge = () => {
    unreadRef.current = 0;
    setUnread(0);
  };

  const dismissToast = (toastId) =>
    setToasts((t) => t.filter((x) => x.toastId !== toastId));

  return { unread, toasts, clearBadge, dismissToast };
}

export function NotificationToasts({ toasts, onDismiss }) {
  if (!toasts || !toasts.length) return null;
  return (
    <div className="live-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.toastId} className="live-toast">
          <span className="live-toast-dot" />
          <div className="live-toast-body">
            <strong>{t.title || "New notification"}</strong>
            <p>{t.message || ""}</p>
          </div>
          <button
            type="button"
            className="live-toast-close"
            onClick={() => onDismiss(t.toastId)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
