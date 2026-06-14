declare global {
  interface Window {
    __COMBATLINK_PUBLIC_ENV__?: {
      url: string;
      key: string;
    };
  }
}

export {};

function readRuntimeEnv(): Record<string, string | undefined> | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
}

function readFromProcess():
  | {
      url: string;
      key: string;
    }
  | undefined {
  const env = readRuntimeEnv();
  if (!env) return undefined;

  const url = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return undefined;
  return { url, key };
}

/** Inline script for SSR: exposes public Supabase config to the browser at runtime. */
export function buildSupabasePublicEnvScript(): string | null {
  const config = readFromProcess();
  if (!config) return null;

  return `window.__COMBATLINK_PUBLIC_ENV__=${JSON.stringify(config)};`;
}

export function getSupabasePublicEnv(): { url: string; key: string } {
  if (typeof window !== "undefined" && window.__COMBATLINK_PUBLIC_ENV__) {
    const { url, key } = window.__COMBATLINK_PUBLIC_ENV__;
    if (url && key) return { url, key };
  }

  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? readFromProcess()?.url;
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? readFromProcess()?.key;

  if (url && key) return { url, key };

  const missing = [
    ...(!url ? ["SUPABASE_URL"] : []),
    ...(!key ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
  ];
  throw new Error(
    `Missing Supabase environment variable(s): ${missing.join(", ")}. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.`
  );
}
