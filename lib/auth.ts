import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

export interface AuthContext {
  user: { id: string; email: string | null };
  profile: Profile | null;
  role: AppRole;
  institutionId: string | null;
}

export const ROLE_HOME: Record<AppRole, string> = {
  super_admin: "/platform",
  institution_admin: "/admin",
  lecturer: "/lecturer",
  student: "/student",
};

export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("user_roles")
        .select("role, institution_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!roleRow) return null;

    return {
      user: { id: user.id, email: user.email ?? null },
      profile: (profile as Profile | null) ?? null,
      role: roleRow.role as AppRole,
      institutionId: (roleRow.institution_id as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(roles?: AppRole[]): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (roles && !roles.includes(ctx.role)) redirect(ROLE_HOME[ctx.role]);
  return ctx;
}

export async function requireInstitution(): Promise<AuthContext & { institutionId: string }> {
  const ctx = await requireAuth(["institution_admin"]);
  if (!ctx.institutionId) redirect("/login");
  return ctx as AuthContext & { institutionId: string };
}

export function roleLabel(role: AppRole) {
  return {
    super_admin: "Super Administrator",
    institution_admin: "Institution Administrator",
    lecturer: "Lecturer",
    student: "Student",
  }[role];
}
