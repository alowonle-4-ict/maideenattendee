import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Offline mode", href: "/features#offline" },
      { label: "Exports", href: "/features#reporting" },
    ],
  },
  {
    title: "Institutions",
    links: [
      { label: "Universities", href: "/register" },
      { label: "Polytechnics", href: "/register" },
      { label: "Colleges", href: "/register" },
      { label: "Training providers", href: "/register" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="page-shell py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              QR attendance for universities, polytechnics and colleges. One
              secure scan per student, every class, online or off.
            </p>
            <p className="text-xs text-muted-foreground">
              Built in Nigeria. Priced in Naira. Ready for your next semester.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {column.title}
              </p>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MaideenAttendee. All rights reserved.</p>
          <p>WCAG-minded · PWA · Data protected with PostgreSQL RLS</p>
        </div>
      </div>
    </footer>
  );
}
