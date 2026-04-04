import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  sanitizeSupabaseEnvValue,
} from "./config";

function getSupabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value) {
    throw new Error("Missing required Supabase env: SUPABASE_SERVICE_ROLE_KEY");
  }

  return sanitizeSupabaseEnvValue(value);
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Admin client with service role key — bypasses RLS.
 * ONLY use in server-side API routes, never expose to client.
 */
export function createAdminClient() {
  return createClient<Database>(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
