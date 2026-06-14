import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase-public-env";
import type { Database } from "@/types/database";

function createSupabaseClient() {
  const { url, key } = getSupabasePublicEnv();

  return createClient<Database>(url, key, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
