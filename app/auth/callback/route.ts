import { NextResponse } from "next/server";

import { ROLE_HOME } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : null;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        if (safeNext) return NextResponse.redirect(`${origin}${safeNext}`);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: roleRow } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();
          const role = roleRow?.role as AppRole | undefined;
          if (role) return NextResponse.redirect(`${origin}${ROLE_HOME[role]}`);
        }
        return NextResponse.redirect(`${origin}/auth/redirect`);
      }
    } catch {
      // fall through to login
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
