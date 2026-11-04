import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CloudOff,
  Database,
  FileSpreadsheet,
  Fingerprint,
  Globe2,
  Layers,
  LockKeyhole,
  RefreshCcw,
  ScanLine,
  ServerCog,
  ShieldCheck,
  Users,
  WifiOff,
  Wifi,
  CheckCircle2,
} from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Features" };

const CORE = [
  { icon: Fingerprint, title: "Permanent student credentials", body: "Every student receives one opaque 192-bit QR token at enrolment. It stays the same across courses and sessions, and can be revoked or regenerated if compromised." },
  { icon: ScanLine, title: "Continuous scanning", body: "The camera stays live and re-arms automatically after each scan. Front/rear switching, torch where supported, and a controlled manual-code fallback." },
  { icon: ShieldCheck, title: "Ten independent checks", body: "Credential validity, revocation, account status, institution, enrolment, lecturer assignment, session state, window, duplicate detection and rate limiting — all server-side." },
  { icon: Ban, title: "Duplicate-proof by constraint", body: "A unique database constraint on (session, student) means a double-scan or retried request can never create a second record." },
  { icon: Users, title: "Role-scoped access", body: "Lecturers see only their assigned courses. Students see only their own records. Administrators see only their institution. Enforced by Postgres RLS." },
  { icon: ServerCog, title: "Server-authoritative times", body: "Closing times are enforced by the server and a scheduled job closes expired sessions. Client clocks cannot extend a window." },
];

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b bg-muted/20 py-16 sm:py-20">
          <div className="page-shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <Badge variant="muted" className="mb-4">Features</Badge>
              <h1 className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                A scanning workflow that holds up in a hall of 500
              </h1>
              <p className="mt-5 text-pretty text-muted-foreground">
                Every button in MaideenAttendee writes to a real database through
                a validated server path. Nothing is simulated, and no scan is
                confirmed until the server has accepted it.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild><Link href="/register">Start free trial <ArrowRight /></Link></Button>
                <Button asChild variant="outline"><Link href="/pricing">See pricing</Link></Button>
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border shadow-soft">
              <Image
                src="/images/qr-checkin.webp"
                alt="A lecturer scanning a student's permanent QR code with a phone"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="page-shell grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CORE.map((item) => (
              <Card key={item.title}>
                <CardContent className="p-6">
                  <item.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <h2 className="mt-4 font-display text-base font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="offline" className="border-y bg-muted/20 py-16">
          <div className="page-shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Badge variant="muted" className="mb-4"><CloudOff className="mr-1 h-3 w-3" /> Offline mode</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight">
                Honest offline attendance
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                The app downloads only the roster and session the lecturer is
                authorised to manage. Scans are stored locally with a unique
                transaction ID, marked as provisionally recorded, and replayed
                when the connection returns.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "IndexedDB queue survives page reloads and app restarts",
                  "Automatic replay on reconnect plus a manual retry control",
                  "Server re-validates every replayed scan against the original window",
                  "Failed items remain visible and are never silently discarded",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: WifiOff, title: "Offline", body: "Camera keeps scanning. Roster is served from IndexedDB.", tone: "warning" },
                { icon: Wifi, title: "Reconnected", body: "The queue drains automatically; the queue badge clears.", tone: "info" },
                { icon: RefreshCcw, title: "Synchronizing", body: "Each record is submitted with its original local timestamp.", tone: "info" },
                { icon: LockKeyhole, title: "Confirmed", body: "Server-stamped, verified and visible to the student.", tone: "success" },
              ].map((state) => (
                <div key={state.title} className="rounded-xl border bg-card p-5 shadow-card">
                  <state.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <p className="mt-3 text-sm font-semibold">{state.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{state.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="reporting" className="py-16">
          <div className="page-shell grid gap-10 lg:grid-cols-2">
            <div>
              <Badge variant="muted" className="mb-4"><FileSpreadsheet className="mr-1 h-3 w-3" /> Reporting</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight">
                Three exports examiners actually ask for
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Every export is generated on the server, scoped to records the
                requester is allowed to see, and includes your institution,
                course, lecturer, session and semester header.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { title: "A · Individual class", body: "Name, matric number, department, course, date, time scanned and status.", icon: Database },
                { title: "B · Course register", body: "Students as rows, class dates as columns, and a percentage column.", icon: Layers },
                { title: "C · Student summary", body: "Classes held, present, absent and attendance percentage per student.", icon: FileSpreadsheet },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-xl border bg-card p-5">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="border-t bg-primary py-16 text-primary-foreground">
          <div className="page-shell">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <Badge className="mb-4 bg-white/10 text-white"><ShieldCheck className="mr-1 h-3 w-3" /> Security</Badge>
                <h2 className="font-display text-3xl font-semibold tracking-tight">
                  Tenant isolation is a database guarantee
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">
                  Frontend filtering is convenience, not security. Every table is
                  protected by PostgreSQL Row Level Security policies that read
                  the authenticated user&apos;s role and institution on each query.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Globe2, label: "PostgreSQL RLS on 25 tables" },
                  { icon: Fingerprint, label: "Opaque QR tokens, no PII" },
                  { icon: LockKeyhole, label: "Service keys server-only" },
                  { icon: ShieldCheck, label: "Webhook signature checks" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5 rounded-lg bg-white/10 p-3.5 text-sm">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 text-center">
          <div className="page-shell">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Ready to run your first scanned lecture?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              Set up your institution in minutes. Your first 14 days are free, and
              your records remain yours if you decide not to continue.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/register">Create your institution <ArrowRight /></Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
