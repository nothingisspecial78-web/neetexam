import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type FriendSharingStatus = {
  myAllowed: Record<string, boolean>; // friendId -> boolean
  friendsAllowedMe: Record<string, boolean>; // friendId -> boolean
  mutualAllowed: string[]; // friend IDs where both are true
};

// Gets question sharing permissions for the current user and their friends
export const getFriendSharingPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendSharingStatus> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch all accepted friendships for this user
    const { data: friendships } = await supabaseAdmin
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    const friendIds = new Set<string>();
    for (const f of friendships || []) {
      const other = f.requester_id === userId ? f.addressee_id : f.requester_id;
      if (other) friendIds.add(other);
    }

    if (friendIds.size === 0) {
      return { myAllowed: {}, friendsAllowedMe: {}, mutualAllowed: [] };
    }

    // 2. Fetch share_permission logs for user and their friends
    const friendIdList = Array.from(friendIds);
    const { data: logs } = await supabaseAdmin
      .from("activity_log")
      .select("user_id, details, created_at")
      .eq("event_type", "share_permission")
      .or(`user_id.eq.${userId},user_id.in.(${friendIdList.join(",")})`)
      .order("created_at", { ascending: true });

    // Track latest permission state per pair: (fromUser -> targetUser)
    const permissions = new Map<string, boolean>(); // key: `${from}->${to}`
    for (const log of logs || []) {
      const target = (log.details as any)?.friend_id;
      const allowed = Boolean((log.details as any)?.allowed);
      if (log.user_id && target) {
        permissions.set(`${log.user_id}->${target}`, allowed);
      }
    }

    const myAllowed: Record<string, boolean> = {};
    const friendsAllowedMe: Record<string, boolean> = {};
    const mutualAllowed: string[] = [];

    for (const fid of friendIdList) {
      const iAllowed = permissions.get(`${userId}->${fid}`) ?? false;
      const theyAllowed = permissions.get(`${fid}->${userId}`) ?? false;

      myAllowed[fid] = iAllowed;
      friendsAllowedMe[fid] = theyAllowed;

      if (iAllowed && theyAllowed) {
        mutualAllowed.push(fid);
      }
    }

    return { myAllowed, friendsAllowedMe, mutualAllowed };
  });

// Toggles question sharing permission with a specific friend
export const toggleFriendQuestionSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { friendId: string; allow: boolean }) =>
    z.object({ friendId: z.string().uuid(), allow: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Insert new state row in activity_log
    const { error } = await supabaseAdmin.from("activity_log").insert({
      user_id: userId,
      event_type: "share_permission",
      details: {
        friend_id: data.friendId,
        allowed: data.allow,
      },
    });

    if (error) {
      console.error("Failed to toggle friend question sharing:", error);
      throw new Error("تعذّر تحديث إعدادات مشاركة الأسئلة");
    }

    return { success: true, friendId: data.friendId, allow: data.allow };
  });
