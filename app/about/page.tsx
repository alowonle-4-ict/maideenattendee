import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, Globe2, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b bg-muted/20 py-16 sm:py-20">
          <div className="page-shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <Badge variant="muted" className="mb-4">About MaideenAttendee</Badge>
              <h1 className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                Attendance records that universities can defend
              </h1>
              <p className="mt-5 text-pretty text-muted-foreground">
                MaideenAttendee was built around a simple observation: attendance is
                evidence. It decides eligibility for examinations, informs
                accreditation visits, and protects students from administrative
                error. It deserves infrastructure, not a shared spreadsheet.
              </p>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border shadow-soft">
              <Image
                src="/images/campus-scan.webp"
                alt="A lecturer scanning a student's QR code at a Nigerian university lecture hall"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="page-shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight">Why we built it</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Manual attendance is slow, easy to falsify and hard to reconcile
                  across departments. Generic form tools lose data when the network
                  drops and cannot enforce who is allowed to mark whom. We wanted a
                  system where a lecturer scans a student&apos;s permanent QR code, the
                  server independently confirms every condition, and the resulting
                  record is immediately available to the student — even if the
                  lecture hall has no signal.
                </p>
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight">How we think about security</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  The browser is treated as hostile. Roles and institution IDs are
                  never trusted from the client. Every privileged action runs
                  through a server route or a security-definer database function
                  that re-reads the authenticated user&apos;s role, institution,
                  course assignment and session state. Tenant separation is
                  enforced by PostgreSQL Row Level Security — not by hiding menu
                  items.
                </p>
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight">Built for the Nigerian context</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Data-inclusive pricing in Naira, Paystack and Flutterwave
                  settlement, low-bandwidth pages, installable PWA support and
                  honest offline behaviour. The system is designed to be usable on
                  the mid-range Android phones that students and lecturers actually
                  carry.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                { icon: ShieldCheck, title: "Evidence first", body: "Immutable financial records, audited corrections and server-stamped timestamps." },
                { icon: Globe2, title: "Multi-tenant by design", body: "One platform, isolated institutions, unlimited campuses and sessions." },
                { icon: HeartHandshake, title: "Respect for institutions", body: "Your records are never held hostage by a subscription lapse." },
                { icon: Building2, title: "Operational fit", body: "Faculty, department, semester, course and lecturer structures match real institutions." },
                { icon: Sparkles, title: "No simulated success", body: "If the server has not accepted a scan, the interface does not claim it has." },
              ].map((item) => (
                <Card key={item.title}>
                  <CardContent className="flex gap-3 p-5">
                    <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/20 py-14 text-center">
          <div className="page-shell">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Talk to the team</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              Planning a faculty-wide rollout? We can discuss semester billing,
              imports from your current system and a supervised pilot.
            </p>
            <Button asChild className="mt-6">
              <Link href="/contact">Contact us <ArrowRight /></Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
