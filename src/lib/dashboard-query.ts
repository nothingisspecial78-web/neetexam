import { queryOptions } from "@tanstack/react-query";
import { getDashboard } from "./dashboard.functions";
export const dashboardOptions = (userId: string) =>
  queryOptions({
    queryKey: ["dashboard", userId],
    queryFn: () => getDashboard(),
    staleTime: 15_000,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });
