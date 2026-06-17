import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { favouritesHasIsSavedColumn } from "@/lib/favourites-schema";

export function useFavouritesSchema() {
  return useQuery({
    queryKey: ["favourites-schema"],
    queryFn: () => favouritesHasIsSavedColumn(supabase),
    staleTime: Infinity,
  });
}
