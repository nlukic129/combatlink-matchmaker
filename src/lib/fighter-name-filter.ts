import type { SearchFighter } from "@/types/database";

function normalizeNamePart(value: string): string {
  return value.trim().toLowerCase();
}

/** Match fighter first/last name or nickname against a free-text query. */
export function matchesFighterNameQuery(fighter: SearchFighter, query: string): boolean {
  const q = normalizeNamePart(query);
  if (!q) return true;

  const first = normalizeNamePart(fighter.first_name);
  const last = normalizeNamePart(fighter.last_name ?? "");
  const nick = normalizeNamePart(fighter.nickname ?? "");
  const full = `${first} ${last}`.trim();
  const reversed = `${last} ${first}`.trim();

  return (
    full.includes(q) ||
    reversed.includes(q) ||
    first.includes(q) ||
    last.includes(q) ||
    nick.includes(q)
  );
}

export function filterFightersByName<T extends SearchFighter>(fighters: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return fighters;
  return fighters.filter((f) => matchesFighterNameQuery(f, q));
}
