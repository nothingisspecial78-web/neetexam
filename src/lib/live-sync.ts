import { supabase } from "@/integrations/supabase/client";

export const LIVE_CHANNEL_NAME = "admin-live-feed";

let liveChannel: ReturnType<typeof supabase.channel> | null = null;

export function getLiveChannel() {
  if (!liveChannel) {
    liveChannel = supabase.channel(LIVE_CHANNEL_NAME, {
      config: {
        broadcast: { ack: false },
      },
    });
    liveChannel.subscribe();
  }
  return liveChannel;
}

/**
 * Dispatches a silent, instant broadcast event over the realtime websocket channel.
 * This triggers background queries to refetch immediately across the app without
 * showing any visible loading indicators or notices to frontend users.
 */
export function notifyLiveSync(event: string = "app_change", payload: Record<string, unknown> = {}) {
  try {
    const ch = getLiveChannel();
    void ch.send({
      type: "broadcast",
      event,
      payload: { ...payload, at: Date.now() },
    });
  } catch {
    // Silent fail - background polling will catch any changes
  }
}
