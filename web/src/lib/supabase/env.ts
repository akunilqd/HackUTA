export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once the Supabase env vars are filled in. The app renders without them, but auth is off. */
export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
