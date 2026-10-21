import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyLiveSync } from "./live-sync";

export const ONLINE_MS = 5 * 60_000;
const PING_MS = 30_000;
let lastPing = 0;

// A friend counts as online when seen within the last 5 minutes.
export function isOnline(lastSeen: string | null | undefined, now = Date.now()) {
  return !!lastSeen && now - new Date(lastSeen).getTime() < ONLINE_MS;
}

// Marks the signed-in student as online while a page is open (every 30 seconds).
export function usePresence() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastPing < PING_MS) return;
      lastPing = Date.now();
      // Query builders are lazy: .then() is what actually sends the request.
      supabase.rpc("touch_presence").then(
        () => {
          notifyLiveSync("presence_ping");
        },
        () => {}
      );
    };
    ping();
    const t = setInterval(ping, 30_000);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", ping); };
  }, []);
}
