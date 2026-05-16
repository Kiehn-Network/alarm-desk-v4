import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateMyLocation } from "@/lib/driver-locations.functions";
import { useAuth } from "./use-auth";

/**
 * Sends the current GPS position of the logged-in user to the server
 * every ~20s, as long as the user is authenticated and the browser
 * grants geolocation permission. No UI.
 */
export function useLocationTracker(enabled: boolean) {
  const { user } = useAuth();
  const update = useServerFn(updateMyLocation);
  const lastSent = useRef(0);
  const latest = useRef<GeolocationPosition | null>(null);

  useEffect(() => {
    if (!enabled || !user) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const send = async (pos: GeolocationPosition) => {
      try {
        await update({
          data: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
            speed: Number.isFinite(pos.coords.speed) ? (pos.coords.speed ?? null) : null,
          },
        });
        lastSent.current = Date.now();
      } catch (e) {
        console.warn("[location] update failed", e);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latest.current = pos;
        if (Date.now() - lastSent.current > 20_000) void send(pos);
      },
      (err) => {
        console.warn("[location] geolocation error", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );

    // Fallback: ensure we still send periodically even when position doesn't change
    const interval = window.setInterval(() => {
      if (latest.current && Date.now() - lastSent.current > 20_000) {
        void send(latest.current);
      }
    }, 20_000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(interval);
    };
  }, [enabled, user, update]);
}