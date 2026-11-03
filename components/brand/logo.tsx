import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact = false,
  href = "/",
  inverted = false,
}: {
  className?: string;
  compact?: boolean;
  href?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="MaideenAttendee home"
    >
      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-900 shadow-sm ring-1 ring-inset ring-white/20">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-white"
          fill="none"
          aria-hidden
        >
          <rect x="3" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
          <rect x="14" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
          <rect x="3" y="14" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
          <rect x="5.2" y="5.2" width="2.6" height="2.6" rx="0.6" fill="currentColor" />
          <rect x="16.2" y="5.2" width="2.6" height="2.6" rx="0.6" fill="currentColor" />
          <path d="M14 14h3v3h-3zM20 14v2M20 20h-3M14 20v-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className={cn("font-display text-[17px] font-semibold tracking-tight", inverted && "text-white")}>
          Maideen<span className="text-brand-500 dark:text-brand-400">Attendee</span>
        </span>
      )}
    </Link>
  );
}
