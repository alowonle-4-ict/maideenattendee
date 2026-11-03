import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = { title: "Terms of service" };

const SECTIONS = [
  {
    title: "1. Agreement",
    body: "By creating an institution account or using MaideenAttendee, you agree to these terms on behalf of your institution. If you do not have authority to bind the institution, do not use the service.",
  },
  {
    title: "2. Accounts and roles",
    body: "Institution administrators are responsible for the accuracy of accounts they create and for assigning lecturers to the correct courses. Credentials must not be shared. Students may only access their own attendance records.",
  },
  {
    title: "3. Subscriptions and billing",
    body: "Paid plans are billed in Nigerian Naira through Paystack or Flutterwave. Subscriptions activate only after the platform independently verifies a successful transaction. Plan limits are displayed before purchase and enforced by the platform.",
  },
  {
    title: "4. Trials",
    body: "New institutions receive a limited trial. At the end of the trial, premium features may be restricted, but historical attendance records are retained. No attendance record is deleted because a subscription expired.",
  },
  {
    title: "5. Acceptable use",
    body: "You may not attempt to access another institution's data, reverse engineer the attendance engine, submit fraudulent payment events, or use the platform to record attendance that did not occur.",
  },
  {
    title: "6. Attendance evidence",
    body: "Attendance records are generated from scans validated by the server. Offline records are provisionally recorded until synchronised. The platform does not guarantee the character of attendance, only the integrity of the recorded event.",
  },
  {
    title: "7. Availability",
    body: "We aim for high availability but do not guarantee uninterrupted service. Offline scanning is provided to reduce the impact of connectivity loss. Maintenance windows will be communicated where practicable.",
  },
  {
    title: "8. Termination",
    body: "Institutions may stop using the service at any time. We may suspend accounts for non-payment, security risk or abuse of the platform. Data retention and deletion follow the privacy policy.",
  },
  {
    title: "9. Liability",
    body: "To the maximum extent permitted by law, MaideenAttendee is not liable for indirect or consequential loss arising from the use of the service. Our aggregate liability is limited to fees paid in the preceding twelve months.",
  },
  {
    title: "10. Changes",
    body: "We may update these terms. Material changes will be communicated to institution administrators before they take effect.",
  },
];

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="page-shell max-w-3xl py-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Terms of service</h1>
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
