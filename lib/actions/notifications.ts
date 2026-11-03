"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/actions/admin";

export async function markAllNotificationsRead(): Promise<ActionState> {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", ctx.user.id)
    .is("read_at", null);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/student/notifications");
  revalidatePath("/lecturer");
  return { ok: true, message: "All notifications marked as read." };
}

export async function markNotificationRead(id: string): Promise<ActionState> {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.user.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/student/notifications");
  return { ok: true, message: "Notification marked as read." };
}
