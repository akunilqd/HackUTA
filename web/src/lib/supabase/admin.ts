import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Server-only Supabase client with the service-role key (same as /api/onboarding and the Argos backend).
 * Bypasses RLS, so every query that touches one patient's rows must filter by that patient's id.
 * Never import this from a Client Component: the key has no NEXT_PUBLIC_ prefix and is not bundled.
 */
export function hasAdminEnv() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("The server is not connected to Supabase yet (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** PostgREST answers PGRST205 (or Postgres 42P01) when a table has not been created yet. */
export const isMissingTable = (error: { code?: string } | null) => error?.code === "PGRST205" || error?.code === "42P01";
