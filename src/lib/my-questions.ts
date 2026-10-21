import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const myQuestionsOptions = (userId: string) => queryOptions({
  queryKey: ["my-questions", userId],
  queryFn: async () => {
    const { data, error } = await supabase.from("questions").select("*, uploads(file_name, created_at)").eq("owner_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  placeholderData: (prev) => prev,
});