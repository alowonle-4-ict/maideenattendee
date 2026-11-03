import { NextResponse } from "next/server";

import { ROLE_HOME } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.redirect(`${origin}/login`);

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = roleRow?.role as AppRole | undefined;
    return NextResponse.redirect(`${origin}${role ? ROLE_HOME[role] : "/login"}`);
  } catch {
    return NextResponse.redirect(`${origin}/login`);
  }
}
