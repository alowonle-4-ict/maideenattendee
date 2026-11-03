import "server-only";

import { randomBytes } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

export function randomPassword() {
  return `${randomBytes(6).toString("base64url")}aA1!`;
}

export function temporaryEmail(slug: string, identifier: string) {
  const safe = slugify(identifier).replace(/-/g, ".").slice(0, 40);
  return `${safe}.${slug.slice(0, 16)}@students.maideenattendee.app`;
}

export async function provisionUser({
  email,
  password,
  fullName,
  institutionId,
  role,
  extra,
}: {
  email: string;
  password: string;
  fullName: string;
  institutionId: string;
  role: "student" | "lecturer";
  extra: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !authUser.user) {
    throw new Error(
      authError?.message.includes("already")
        ? "An account with this email already exists."
        : authError?.message ?? "Could not create account."
    );
  }

  try {
    const { error: profileError } = await admin.from("profiles").upsert({
      id: authUser.user.id,
      institution_id: institutionId,
      full_name: fullName,
      email,
      ...extra,
    });
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: authUser.user.id,
      institution_id: institutionId,
      role,
    });
    if (roleError) throw new Error(roleError.message);

    return authUser.user.id;
  } catch (error) {
    await admin.auth.admin.deleteUser(authUser.user.id).catch(() => undefined);
    throw error;
  }
}
