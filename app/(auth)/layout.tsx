import Link from "next/link";
import { ArrowLeft, CheckCircle2, QrCode, ShieldCheck, WifiOff } from "lucide-react";

import { Logo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="noise pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-white/5 blur-2xl" />

        <div className="relative">
          <Logo inverted />
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/60">
            Attendance infrastructure
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight">
            One scan per student. <br />
            One record that holds.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            MaideenAttendee gives lecturers a fast QR workflow, gives students
            transparent attendance records, and gives administrators evidence
            they can defend.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              { icon: QrCode, text: "Permanent, opaque QR credentials for every student" },
              { icon: WifiOff, text: "Offline scanning with honest sync states" },
              { icon: ShieldCheck, text: "Tenant isolation enforced by PostgreSQL RLS" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10">
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="text-primary-foreground/85">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-xs text-primary-foreground/50">
          <span>© {new Date().getFullYear()} MaideenAttendee</span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Built for Nigerian institutions
          </span>
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-5 lg:hidden">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
