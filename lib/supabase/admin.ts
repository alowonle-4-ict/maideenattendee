import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — only for trusted server-side operations
 * (provisioning users, webhooks, scheduled maintenance). Never import into a
 * client component.
 */
export function createAdminClient() {
  if (!env.supabaseUrl || !env.serviceRole) {
    throw new Error(
      "Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
  return createSupabaseClient(env.supabaseUrl, env.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
