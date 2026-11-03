import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = { title: "Privacy policy" };

const SECTIONS = [
  {
    title: "What we collect",
    body: "Institution details, user names, institutional email addresses, matriculation and staff numbers, course enrolment, attendance events and payment records. Student QR codes contain a random opaque token — never a name, matric number or biometric datum.",
  },
  {
    title: "Why we collect it",
    body: "To authenticate users, record attendance, calculate attendance percentages, generate reports, process subscription payments and provide support. Attendance records are evidence for academic administration.",
  },
  {
    title: "Tenant isolation",
    body: "Each institution's data is separated at the database layer using PostgreSQL Row Level Security. Staff and students can only read records their role and institution permit. Payment secrets are stored as server-side environment variables.",
  },
  {
    title: "Payments",
    body: "Card data is handled entirely by Paystack or Flutterwave. MaideenAttendee stores transaction references, amounts, currency, gateway and status for reconciliation. Webhook signatures are verified before a subscription is activated.",
  },
  {
    title: "Offline data",
    body: "The lecturer's device caches the roster and session information required for an authorised attendance session. Queued attendance is stored in the browser's IndexedDB until synchronised, then removed after server confirmation.",
  },
  {
    title: "Retention",
    body: "Attendance records and financial records are retained for the life of the institution's account and for the period required by applicable academic and financial regulations. Records are not deleted solely because a subscription expires.",
  },
  {
    title: "Your rights",
    body: "Users may request access to their personal data and correction of inaccurate details through their institution administrator. Institutional data requests are handled by the institution that owns the account.",
  },
  {
    title: "Contact",
    body: "Privacy questions can be sent to privacy@maideenattendee.app. We will respond within a reasonable period and may ask for verification of identity.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="page-shell max-w-3xl py-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Privacy policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated 3 November 2026</p>
          <div className="mt-10 space-y-8">
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="font-display text-base font-semibold">{section.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
