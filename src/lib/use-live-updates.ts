"use client";

import { useEffect, useRef, useState } from "react";

import { API_BASE } from "./api";

export type LiveStatus = "connecting" | "live" | "offline";

/**
 * Subscribes to the backend's Server-Sent Events stream.
 *
 * The server closes each stream at ~50s to stay inside the serverless function
 * ceiling; `EventSource` reconnects on its own, so a close is normal rather
 * than an error. We only surface "offline" once a reconnect has actually
 * failed, otherwise the indicator would flicker every cycle.
 */
export function useLiveUpdates(onChange: () => void) {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const callback = useRef(onChange);

  // Keep the latest callback without re-opening the stream on every render.
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let sawOpen = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource(`${API_BASE}/events/stream`, {
        withCredentials: true,
      });

      source.addEventListener("open", () => {
        sawOpen = true;
        setStatus("live");
      });

      source.addEventListener("connected", () => setStatus("live"));

      source.addEventListener("data-changed", (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data);
          setLastEventAt(payload.at ?? new Date().toISOString());
        } catch {
          setLastEventAt(new Date().toISOString());
        }
        callback.current();
      });

      source.addEventListener("error", () => {
        source?.close();
        // A clean cycle-end looks identical to a drop from here, so only call
        // it offline if we never managed to open in the first place.
        setStatus(sawOpen ? "connecting" : "offline");
        if (!closed) {
          retry = setTimeout(connect, 3000);
        }
      });
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, []);

  return { status, lastEventAt };
}
