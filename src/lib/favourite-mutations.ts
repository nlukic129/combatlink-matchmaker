import type { SupabaseClient } from "@supabase/supabase-js";
import { favouritesHasIsSavedColumn } from "@/lib/favourites-schema";

type FavClient = SupabaseClient;

export async function saveFavourite(
  supabase: FavClient,
  matchmakerId: string,
  fighterId: string,
) {
  const hasIsSaved = await favouritesHasIsSavedColumn(supabase);
  const row: Record<string, unknown> = {
    matchmaker_id: matchmakerId,
    fighter_id: fighterId,
    notify: true,
  };
  if (hasIsSaved) row.is_saved = true;

  const { error } = await supabase.from("matchmaker_favourites").upsert(row, {
    onConflict: "fighter_id,matchmaker_id",
  });
  if (error) throw error;
}

export async function removeSavedFavourite(supabase: FavClient, fighterId: string) {
  const { error } = await supabase.from("matchmaker_favourites").delete().eq("fighter_id", fighterId);
  if (error) throw error;
}

export async function setNotifyWatch(
  supabase: FavClient,
  matchmakerId: string,
  fighterId: string,
  enabled: boolean,
  isSaved: boolean,
) {
  const hasIsSaved = await favouritesHasIsSavedColumn(supabase);

  if (enabled) {
    const row: Record<string, unknown> = {
      matchmaker_id: matchmakerId,
      fighter_id: fighterId,
      notify: true,
    };
    if (hasIsSaved) row.is_saved = isSaved;

    const { error } = await supabase.from("matchmaker_favourites").upsert(row, {
      onConflict: "fighter_id,matchmaker_id",
    });
    if (error) throw error;
    return;
  }

  if (isSaved || !hasIsSaved) {
    const { error } = await supabase
      .from("matchmaker_favourites")
      .update({ notify: false })
      .eq("fighter_id", fighterId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("matchmaker_favourites").delete().eq("fighter_id", fighterId);
  if (error) throw error;
}
