import { supabase } from "@/integrations/supabase/client";

export async function logFighterPresented(fighterIds: string[]) {
  if (!fighterIds.length) return;

  const { data: session } = await supabase.auth.getSession();
  const matchmakerId = session?.session?.user?.id;
  if (!matchmakerId) return;

  await supabase.from("matchmaking_logs").insert(
    fighterIds.map((fighter_id) => ({
      matchmaker_id: matchmakerId,
      fighter_id,
      event_type: "fighter_presented" as const,
    }))
  );
}
