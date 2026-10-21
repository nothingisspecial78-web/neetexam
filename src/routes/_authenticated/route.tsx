import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { IncomingChallengeModal } from "@/components/IncomingChallengeModal";

// Client-only gate: unconfirmed users never get a session, so they land on /auth.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      return { user: sessionData.session.user };
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "login" } });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouterState();
  const path = router.location.pathname;

  // Distraction-free screens hide the bottom bar (Exam, Practice, Admin)
  const isDistractionFree =
    path === "/admin" ||
    path.startsWith("/app/exam") ||
    (path.startsWith("/app/units/") && path !== "/app/units");

  // Query incoming friend requests for badge
  const incomingQuery = useQuery({
    queryKey: ["incoming-badge", user.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", user.id)
        .eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30_000,
    enabled: !isDistractionFree,
  });

  // Query arena invites for badge
  const invitesQuery = useQuery({
    queryKey: ["arena-invites-badge", user.id],
    queryFn: async () => {
      const { data, count } = await supabase
        .from("matches")
        .select("id, created_at", { count: "exact" })
        .eq("player_b", user.id)
        .eq("kind", "challenge")
        .eq("status", "invited");
      if (!data) return 0;
      // Filter out stale invites
      const active = data.filter((m) => {
        const age = Date.now() - new Date(m.created_at).getTime();
        return age <= 65_000 && age >= -15_000;
      });
      return active.length;
    },
    refetchInterval: isDistractionFree ? false : 3000,
    enabled: !isDistractionFree,
  });

  return (
    <div className={`min-h-screen ${!isDistractionFree ? "pb-24 md:pb-0" : ""}`}>
      <Outlet />
      <IncomingChallengeModal userId={user.id} />
      {!isDistractionFree && (
        <BottomNav
          incomingFriendsCount={incomingQuery.data ?? 0}
          arenaInvitesCount={invitesQuery.data ?? 0}
        />
      )}
    </div>
  );
}
