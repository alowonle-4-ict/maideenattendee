import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { billingLabel, getPublicPlans } from "@/lib/plans";
import { formatNGN, formatNumber } from "@/lib/utils";

export const metadata = { title: "Pricing" };

const COMPARISON = [
  { feature: "Student limit", key: "students" },
  { feature: "Lecturer limit", key: "lecturers" },
  { feature: "Course limit", key: "courses" },
  { feature: "QR attendance", key: "qr" },
  { feature: "Offline synchronization", key: "offline" },
  { feature: "Real-time dashboards", key: "realtime" },
  { feature: "Advanced analytics", key: "analytics" },
  { feature: "Multiple campuses", key: "campuses" },
  { feature: "White-label branding", key: "whiteLabel" },
];

const MATRIX: Record<string, Record<string, boolean>> = {
  starter: { qr: true, offline: false, realtime: false, analytics: false, campuses: false, whiteLabel: false },
  basic: { qr: true, offline: true, realtime: true, analytics: false, campuses: false, whiteLabel: false },
  professional: { qr: true, offline: true, realtime: true, analytics: true, campuses: false, whiteLabel: false },
  enterprise: { qr: true, offline: true, realtime: true, analytics: true, campuses: true, whiteLabel: true },
};

const FAQS = [
  {
    q: "How does the 14-day trial work?",
    a: "Create an institution account and you receive a fully featured trial for 14 days. No card is required. At the end of the trial, choose a plan to keep premium features and existing records.",
  },
  {
    q: "Do you charge per student or per institution?",
    a: "Each plan includes a student allowance. If you outgrow it, upgrade to the next plan. Custom enterprise pricing and per-student arrangements are available on request.",
  },
  {
    q: "What happens when my subscription expires?",
    a: "Historical attendance records are never deleted. Your institution enters a grace period, premium features are restricted, and renewal notifications are sent to administrators.",
  },
  {
    q: "Which payment methods are supported?",
    a: "Paystack and Flutterwave, in Nigerian Naira. Both gateways are verified server-side before a subscription is activated.",
  },
  {
    q: "Can we pay per semester?",
    a: "Yes. Semester and custom billing cycles can be configured by the platform team, and plan prices are controlled centrally rather than hardcoded into the app.",
  },
];

export default async function PricingPage() {
  const plans = await getPublicPlans();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b bg-muted/20 py-16 text-center sm:py-20">
          <div className="page-shell max-w-3xl">
            <Badge variant="muted" className="mb-4">Pricing</Badge>
            <h1 className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Simple plans, priced for Nigerian institutions
            </h1>
            <p className="mt-5 text-pretty text-muted-foreground">
              Every plan includes unlimited QR scans, permanent student
              credentials, duplicate protection and audit-ready records. Start
              with 14 days free.
            </p>
          </div>
        </section>

        <section className="py-14">
          <div className="page-shell">
            <div className="grid gap-4 lg:grid-cols-4">
              {plans.map((plan, index) => {
                const featured = index === 2;
                return (
                  <Card
                    key={plan.slug}
                    className={
                      featured
                        ? "relative border-brand-300 shadow-soft ring-1 ring-brand-200 dark:border-brand-700 dark:ring-brand-800"
                        : "relative"
                    }
                  >
                    {featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                        Most chosen
                      </span>
                    )}
                    <CardContent className="flex h-full flex-col p-6">
                      <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
                      <p className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                      <div className="mt-4">
                        <span className="font-display text-3xl font-semibold tracking-tight">
                          {formatNGN(plan.price_ngn)}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {billingLabel(plan.billing_cycle)}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-2 text-center">
                        <div>
                          <p className="text-xs font-semibold">{formatNumber(plan.max_students)}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">Students</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{formatNumber(plan.max_lecturers)}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">Lecturers</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{formatNumber(plan.max_courses)}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">Courses</p>
                        </div>
                      </div>
                      <ul className="mt-5 flex-1 space-y-2.5">
                        {(plan.features ?? []).map((feature) => (
                          <li key={feature} className="flex gap-2 text-sm">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        asChild
                        className="mt-6 w-full"
                        variant={featured ? "default" : "outline"}
                      >
                        <Link href={`/register?plan=${plan.slug}`}>
                          {plan.price_ngn === 0 ? "Start free" : "Start free trial"}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Prices exclude VAT where applicable. Plan limits and prices are
              configurable by the platform administrator.
            </p>
          </div>
        </section>

        <section className="border-y bg-muted/20 py-16">
          <div className="page-shell">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Compare plans</h2>
            <div className="mt-6 table-shell overflow-x-auto">
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Capability</th>
                    {plans.map((plan) => (
                      <th key={plan.slug} className="text-center">{plan.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature}>
                      <td className="font-medium">{row.feature}</td>
                      {plans.map((plan) => {
                        if (row.key === "students") {
                          return <td key={plan.slug} className="text-center">{formatNumber(plan.max_students)}</td>;
                        }
                        if (row.key === "lecturers") {
                          return <td key={plan.slug} className="text-center">{formatNumber(plan.max_lecturers)}</td>;
                        }
                        if (row.key === "courses") {
                          return <td key={plan.slug} className="text-center">{formatNumber(plan.max_courses)}</td>;
                        }
                        const value = MATRIX[plan.slug]?.[row.key];
                        return (
                          <td key={plan.slug} className="text-center">
                            {value ? (
                              <Check className="mx-auto h-4 w-4 text-success" />
                            ) : (
                              <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="page-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Questions, answered</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Need a formal quote, semester billing, or a multi-campus
                agreement? Our team can prepare one.
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link href="/contact">Contact sales</Link>
              </Button>
            </div>
            <div className="space-y-3">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group rounded-xl border bg-card p-5">
                  <summary className="cursor-pointer list-none font-medium marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {faq.q}
                      <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
