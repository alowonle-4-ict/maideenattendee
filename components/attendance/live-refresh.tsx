"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Refreshes server-rendered attendance data when Postgres changes arrive.
 * Rows are still rendered by the server, so RLS continues to apply.
 */
export function LiveRefresh({
  sessionId,
  table = "attendance_records",
  filterColumn = "attendance_session_id",
  intervalMs = 20_000,
}: {
  sessionId: string;
  table?: "attendance_records" | "attendance_sessions";
  filterColumn?: "attendance_session_id" | "id";
  intervalMs?: number;
}) {
  const router = useRouter();
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-${table}-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${filterColumn}=eq.${sessionId}`,
        },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 350);
        }
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [filterColumn, router, sessionId, table]);

  // Realtime connections can drop silently on mobile networks; poll as a fallback.
  React.useEffect(() => {
    if (!intervalMs) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);

  return null;
}
