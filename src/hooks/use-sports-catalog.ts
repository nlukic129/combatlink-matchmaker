import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SportCatalogItem = {
  slug: string;
  label: string;
};

export function useSportsCatalog() {
  return useQuery<SportCatalogItem[]>({
    queryKey: ["sports-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("slug, label")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSportLabel() {
  const { data: sports = [] } = useSportsCatalog();
  return (slug: string) =>
    sports.find((s) => s.slug === slug)?.label ??
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, " ");
}
