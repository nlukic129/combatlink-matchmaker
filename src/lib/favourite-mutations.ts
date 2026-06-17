import type { SupabaseClient } from "@supabase/supabase-js";

type FavClient = SupabaseClient;

export async function saveFavourite(
  supabase: FavClient,
  matchmakerId: string,
  fighterId: string,
) {
  const { error } = await supabase.from("matchmaker_favourites").upsert(
    {
      matchmaker_id: matchmakerId,
      fighter_id: fighterId,
      notify: true,
      is_saved: true,
    },
    { onConflict: "fighter_id,matchmaker_id" },
  );
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
  if (enabled) {
    const { error } = await supabase.from("matchmaker_favourites").upsert(
      {
        matchmaker_id: matchmakerId,
        fighter_id: fighterId,
        notify: true,
        is_saved: isSaved,
      },
      { onConflict: "fighter_id,matchmaker_id" },
    );
    if (error) throw error;
    return;
  }

  if (isSaved) {
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
