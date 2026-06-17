import type { SupabaseClient } from "@supabase/supabase-js";

type FavClient = SupabaseClient;

let isSavedColumnSupported: boolean | null = null;

/** Detect whether `matchmaker_favourites.is_saved` has been migrated. Cached for the session. */
export async function favouritesHasIsSavedColumn(supabase: FavClient): Promise<boolean> {
  if (isSavedColumnSupported !== null) return isSavedColumnSupported;

  const { error } = await supabase.from("matchmaker_favourites").select("is_saved").limit(1);
  isSavedColumnSupported = !error;
  return isSavedColumnSupported;
}

export type FavouriteRow = {
  id?: number;
  notify?: boolean;
  is_saved?: boolean;
};

/** Heart filled — saved favourite, or any row before is_saved migration. */
export function isSavedFavourite(row: FavouriteRow | null | undefined, hasIsSaved: boolean): boolean {
  if (!row) return false;
  if (hasIsSaved) return row.is_saved === true;
  return true;
}

export function isNotifyEnabled(row: FavouriteRow | null | undefined): boolean {
  return row?.notify === true;
}
