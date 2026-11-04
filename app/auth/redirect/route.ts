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

    const { data: roleRow, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = !error && roleRow?.role ? (roleRow.role as AppRole) : null;
    const home = role ? ROLE_HOME[role] : undefined;
    if (home) return NextResponse.redirect(`${origin}${home}`);

    // Clear the session so middleware stops treating this as a signed-in user.
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?notice=${error ? "auth_unavailable" : "no_role"}`
    );
  } catch {
    return NextResponse.redirect(`${origin}/login?notice=auth_unavailable`);
  }
}
