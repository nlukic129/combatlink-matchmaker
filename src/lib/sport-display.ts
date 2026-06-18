import type { SportCatalogItem } from "@/hooks/use-sports-catalog";

const SPORT_MARKS: Record<string, string> = {
  mma: "MMA",
  boxing: "BOX",
  kickboxing: "KICK",
  bare_knuckle: "BK",
};

export function sportMark(slug: string, label: string): string {
  return SPORT_MARKS[slug] ?? label.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4);
}

export function sportLabelFromCatalog(slug: string, catalog: SportCatalogItem[]): string {
  return (
    catalog.find((s) => s.slug === slug)?.label ??
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, " ")
  );
}
