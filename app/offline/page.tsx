import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff, QrCode, RefreshCw } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { OfflineRetry } from "@/components/pwa/offline-retry";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "You are offline",
  description: "MaideenAttendee needs a connection for this page.",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-card">
        <Logo />

        <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <CloudOff className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          This page needs a connection
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You are offline, so MaideenAttendee cannot load this screen. Attendance you scanned in
          offline mode stays queued on this device and will be sent automatically when the
          connection returns.
        </p>

        <div className="mt-6 space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
          <p className="flex items-start gap-2">
            <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            Lecturers: open the app from the home screen to keep using the offline scanner.
          </p>
          <p className="flex items-start gap-2">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            Students: your QR code is available once the page reconnects.
          </p>
        </div>

        <div className="mt-8">
          <OfflineRetry />
        </div>

        <div className="mt-6 border-t pt-4 text-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Go to homepage</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
