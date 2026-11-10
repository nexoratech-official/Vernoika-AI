export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  if (!url && !anonKey) return null;
  if (!url || !anonKey) {
    throw new Error("Set both SUPABASE_URL and SUPABASE_ANON_KEY to enable Supabase.");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL must be a valid absolute URL.");
  }
  const isLoopback =
    endpoint.hostname === "localhost" ||
    endpoint.hostname === "127.0.0.1" ||
    endpoint.hostname === "[::1]";
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && isLoopback)) {
    throw new Error("SUPABASE_URL must use HTTPS except for a local development endpoint.");
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("SUPABASE_URL must not contain credentials, query parameters, or a fragment.");
  }

  return { url: url.replace(/\/+$/, ""), anonKey };
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() || process.env.SUPABASE_ANON_KEY?.trim());
}
