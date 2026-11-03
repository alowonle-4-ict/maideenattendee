import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  CloudOff,
  FileSpreadsheet,
  Fingerprint,
  GraduationCap,
  LockKeyhole,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  WifiOff,
  Zap,
} from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: ScanLine,
    title: "Lecturer-led scanning",
    description:
      "Students are never asked to scan a lecturer's code. Lecturers scan each student's permanent QR credential, one tap at a time.",
  },
  {
    icon: WifiOff,
    title: "Works without network",
    description:
      "Classrooms lose signal. Attendance does not. Scans are stored in IndexedDB and synchronised the moment connectivity returns.",
  },
  {
    icon: ShieldCheck,
    title: "Server-authoritative",
    description:
      "Every scan is validated against enrolment, assignment, session window and revocation state on the server. The browser is never trusted.",
  },
  {
    icon: Fingerprint,
    title: "Opaque QR credentials",
    description:
      "Each QR encodes a random 192-bit token — no names, no matric numbers. Compromised credentials can be revoked and regenerated instantly.",
  },
  {
    icon: BarChart3,
    title: "Live attendance",
    description:
      "Realtime counts update for the lecturer and student the moment a scan lands. Percentages, absentees and late arrivals at a glance.",
  },
  {
    icon: FileSpreadsheet,
    title: "Board-ready exports",
    description:
      "Class registers, full course attendance sheets and student summaries — exported to Excel with your institution's header.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Set up your institution",
    body: "Faculties, departments, campuses and academic sessions. Import students and lecturers from Excel.",
  },
  {
    step: "02",
    title: "Assign courses",
    body: "Register students, assign lecturers, and every student automatically receives a permanent QR credential.",
  },
  {
    step: "03",
    title: "Open attendance",
    body: "The lecturer sets an opening and closing window, then starts scanning. Each QR scan is validated server-side.",
  },
  {
    step: "04",
    title: "Review and export",
    body: "Live dashboards update instantly. Export registers for examinations, accreditation or departmental review.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 hero-grid" />
          <div className="pointer-events-none absolute left-1/2 top-[-18rem] h-[34rem] w-[58rem] -translate-x-1/2 rounded-full bg-brand-400/10 blur-3xl dark:bg-brand-600/10" />
          <div className="page-shell relative grid gap-14 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-6 gap-2 border-brand-200 bg-background/70 py-1 pl-1.5 pr-3 text-xs backdrop-blur dark:border-brand-800">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white">
                  <Sparkles className="h-3 w-3" />
                </span>
                Attendance infrastructure for Nigerian institutions
              </Badge>
              <h1 className="text-balance font-display text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.6rem]">
                Every student.
                <br />
                Every class.
                <span className="relative whitespace-nowrap text-brand-600 dark:text-brand-400">
                  {" "}Accounted for.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                MaideenAttendee lets lecturers scan each student&apos;s unique QR
                code at the door. Permanent credentials, duplicate-proof records,
                and attendance that keeps working when the network doesn&apos;t.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="group">
                  <Link href="/register">
                    Start 14-day free trial
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/pricing">View pricing in NGN</Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" /> No card required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Unlimited scans
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Data stays yours
                </span>
              </div>
            </div>

            {/* Product mock */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-500/15 via-transparent to-transparent blur-2xl" />
              <div className="relative rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Live session
                    </p>
                    <p className="font-display text-sm font-semibold">CSC 301 · Data Structures</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                    Scanning
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Registered", value: "85" },
                    { label: "Present", value: "62" },
                    { label: "Rate", value: "72.9%" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border bg-background px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                      <p className="font-display text-lg font-semibold">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-xl border bg-background p-3">
                  <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-primary/5">
                    <QrCode className="h-16 w-16 text-primary" strokeWidth={1.2} />
                    <span className="scan-overlay-line !inset-x-2" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-success">
                      Attendance successful
                    </p>
                    <p className="truncate font-display text-sm font-semibold">Amina Bello</p>
                    <p className="text-xs text-muted-foreground">2023/CSC/041 · 10:42 AM</p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <BadgeCheck className="h-3 w-3" /> Verified on server
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {[
                    ["Chinedu Okafor", "2023/CSC/017", "10:41"],
                    ["Fatima Yusuf", "2023/CSC/029", "10:42"],
                    ["Amina Bello", "2023/CSC/041", "10:42"],
                  ].map(([name, matric, time]) => (
                    <div key={matric} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/60">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        <span className="truncate font-medium">{name}</span>
                        <span className="hidden truncate text-muted-foreground sm:inline">{matric}</span>
                      </div>
                      <span className="text-muted-foreground">{time}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CloudOff className="h-3.5 w-3.5" /> Offline queue ready
                  </span>
                  <span className="font-medium text-foreground">0 pending</span>
                </div>
              </div>
              <div className="absolute -bottom-5 -right-3 hidden rounded-xl border bg-card px-3.5 py-2.5 shadow-soft sm:flex sm:items-center sm:gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success">
                  <LockKeyhole className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tenant isolation</p>
                  <p className="text-xs font-semibold">Enforced by Postgres RLS</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stat band */}
        <section className="border-b bg-muted/20">
          <div className="page-shell grid grid-cols-2 divide-x divide-border py-8 md:grid-cols-4">
            {[
              { value: "1 scan", label: "per student, per class" },
              { value: "24/7", label: "offline capture & sync" },
              { value: "100%", label: "server-validated records" },
              { value: "NGN", label: "native billing & receipts" },
            ].map((item) => (
              <div key={item.label} className="px-4 text-center first:pl-0 last:pr-0 sm:px-6">
                <p className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 sm:py-24">
          <div className="page-shell">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="muted" className="mb-4">Built for real classrooms</Badge>
              <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Attendance software that understands the lecture hall
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground">
                Not another form. A purpose-built scanning workflow, enforced at the
                database layer so records survive audits, spotty networks and large
                class sizes.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <Card key={feature.title} className="group transition-shadow hover:shadow-soft">
                  <CardContent className="p-6">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border bg-background text-brand-600 shadow-sm transition-colors group-hover:border-brand-200 group-hover:bg-brand-50 dark:text-brand-400 dark:group-hover:bg-brand-950">
                      <feature.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 font-display text-base font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y bg-muted/20 py-20 sm:py-24">
          <div className="page-shell">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div className="lg:sticky lg:top-24">
                <Badge variant="muted" className="mb-4">From onboarding to register</Badge>
                <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  Live in one semester, not one year
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Import your existing student list, assign courses, and start
                  scanning the same week. No hardware. No bespoke integration.
                </p>
                <div className="mt-8 space-y-4 rounded-xl border bg-card p-5 shadow-card">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-warning" />
                    <div>
                      <p className="text-sm font-medium">Works on the phones they already own</p>
                      <p className="text-xs text-muted-foreground">Any modern Android, iPhone, tablet or laptop camera.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                    <div>
                      <p className="text-sm font-medium">Installable as an app</p>
                      <p className="text-xs text-muted-foreground">Add to home screen. Full-screen scanner. No app store.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-medium">One platform, many institutions</p>
                      <p className="text-xs text-muted-foreground">Hard tenant separation with row-level security.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {STEPS.map((step, index) => (
                  <div
                    key={step.step}
                    className="flex gap-5 rounded-xl border bg-card p-5 shadow-card"
                  >
                    <div className="flex flex-col items-center">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-background font-display text-xs font-semibold text-brand-600 dark:text-brand-400">
                        {step.step}
                      </span>
                      {index < STEPS.length - 1 && (
                        <span className="mt-2 hidden w-px flex-1 bg-border sm:block" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Offline */}
        <section id="offline" className="py-20 sm:py-24">
          <div className="page-shell grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="muted" className="mb-4">Offline-first, honestly labelled</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                No signal in the hall? Keep scanning.
              </h2>
              <p className="mt-4 text-muted-foreground">
                The roster and session window are cached before you start. Scans
                are written to IndexedDB instantly and queued with a unique
                transaction ID. When the network comes back, the server validates
                every record and marks it synchronised.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Provisionally recorded — never falsely shown as server-confirmed",
                  "Automatic retry when connectivity returns, plus manual retry",
                  "Duplicate submissions rejected by a database constraint",
                  "Expired windows and suspicious timestamps flagged on replay",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-7">
                <Link href="/features#offline">
                  See how offline sync works <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold">Sync status</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">
                  <WifiOff className="h-3 w-3" /> Offline
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { name: "Ibrahim Musa", matric: "2023/CSC/008", state: "Pending sync", tone: "warning" as const },
                  { name: "Grace Adeyemi", matric: "2023/CSC/012", state: "Pending sync", tone: "warning" as const },
                  { name: "Tunde Balogun", matric: "2023/CSC/024", state: "Synchronized", tone: "success" as const },
                  { name: "Ngozi Eze", matric: "2023/CSC/033", state: "Synchronized", tone: "success" as const },
                ].map((row) => (
                  <div key={row.matric} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.matric}</p>
                    </div>
                    <Badge variant={row.tone}>{row.state}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-dashed p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Queued records</span>
                  <span className="font-semibold">2 of 4</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/2 rounded-full bg-warning" />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Records stay provisionally recorded until the server accepts them.
                  Failed uploads are never silently discarded.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="border-y bg-muted/20 py-20 sm:py-24">
          <div className="page-shell">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="muted" className="mb-4">One platform, four experiences</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Purpose-built for each role
              </h2>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Building2, title: "Super admin", body: "Institutions, plans, revenue, gateways and audit trails across the platform." },
                { icon: Users, title: "Institution admin", body: "Faculties, students, lecturers, courses, reports and subscription billing." },
                { icon: ScanLine, title: "Lecturer", body: "Only assigned courses. Fast scanning, live counts and Excel exports." },
                { icon: GraduationCap, title: "Student", body: "Permanent QR code, per-course attendance, percentages and notifications." },
              ].map((role) => (
                <Card key={role.title}>
                  <CardContent className="p-6">
                    <role.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                    <h3 className="mt-4 font-display text-sm font-semibold">{role.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{role.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 sm:py-24">
          <div className="page-shell">
            <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-primary-foreground sm:px-12">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
              <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
                <div>
                  <h2 className="max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    Take attendance once. Trust it forever.
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-primary-foreground/75 sm:text-base">
                    Start with a 14-day trial, import your first course, and run
                    your next lecture on MaideenAttendee.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/register">Create institution account</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    <Link href="/contact">Talk to us</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
