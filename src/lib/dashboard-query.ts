import { queryOptions } from "@tanstack/react-query";
import { getDashboard } from "./dashboard.functions";

export const dashboardOptions = (userId: string) =>
  queryOptions({
    queryKey: ["dashboard", userId],
    queryFn: () => getDashboard(),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
