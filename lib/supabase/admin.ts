import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import { getSupabaseUrl } from "@/lib/supabase/env"

/** Service-role client for trusted server jobs (webhooks). Never expose to the browser. */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY")
  }

  return createSupabaseClient<Database>(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
