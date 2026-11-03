"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/actions/admin";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAuth();
  const schema = z.object({
    full_name: z.string().trim().min(2, "Enter your full name").max(160),
    phone: z.string().trim().max(30).optional(),
  });
  const parsed = schema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Check the form.", fieldErrors: { full_name: parsed.error.issues[0]?.message } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone ?? null })
    .eq("id", ctx.user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/lecturer/profile");
  revalidatePath("/student/profile");
  revalidatePath("/admin");
  return { ok: true, message: "Profile updated." };
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  if (password !== confirm) return { ok: false, message: "Passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password updated." };
}
