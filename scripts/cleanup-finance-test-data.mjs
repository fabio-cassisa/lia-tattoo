import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

function getEnv(text, key) {
  const line = text
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));

  if (!line) {
    throw new Error(`Missing ${key} in .env.local`);
  }

  let value = line.slice(key.length + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

const envText = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const supabaseUrl = getEnv(envText, "NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = getEnv(envText, "SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const labels = ["April Malmö Test", "April Copenhagen Test"];

const { data, error } = await supabase
  .from("finance_projects")
  .delete()
  .in("project_label", labels)
  .select("id, project_label");

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(JSON.stringify(data ?? [], null, 2));
