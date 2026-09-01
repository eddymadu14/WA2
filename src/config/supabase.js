
import { createClient } from "@supabase/supabase-js";

const isProduction =
  process.env.NODE_ENV === "production";

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const bucket =
  process.env.SUPABASE_WHATSAPP_BUCKET ||
  "whatsapp-sessions";

if (
  isProduction &&
  (!supabaseUrl || !supabaseServiceRoleKey)
) {
  throw new Error(
    "Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

export const supabase =
  isProduction && supabaseUrl && supabaseServiceRoleKey
    ? createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      )
    : null;

export const supabaseBucket = bucket;

export function isSupabaseEnabled() {
  return Boolean(
    isProduction &&
      supabase &&
      supabaseUrl &&
      supabaseServiceRoleKey
  );
}
