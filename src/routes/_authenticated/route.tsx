import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

// Client-only gate: unconfirmed users never get a session, so they land on /auth.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
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
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("player_b", user.id)
        .eq("status", "invited")
        .gt("created_at", since);
      return count ?? 0;
    },
    refetchInterval: isDistractionFree ? false : 12_000,
    enabled: !isDistractionFree,
  });

  return (
    <div className={`min-h-screen ${!isDistractionFree ? "pb-20 md:pb-0" : ""}`}>
      <Outlet />
      {!isDistractionFree && (
        <BottomNav
          incomingFriendsCount={incomingQuery.data ?? 0}
          arenaInvitesCount={invitesQuery.data ?? 0}
        />
      )}
    </div>
  );
}
