function readRequiredPublicEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required Supabase env: ${name}`);
  }

  return sanitizeSupabaseEnvValue(value);
}

export function sanitizeSupabaseEnvValue(value: string) {
  return value.replace(/(?:\\n|\r?\n)+$/g, "").trimEnd();
}

export function getSupabaseUrl() {
  return readRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return readRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
