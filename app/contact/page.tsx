import { Clock, Mail, MapPin, MessageSquare } from "lucide-react";

import { ContactForm } from "@/app/contact/contact-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b bg-muted/20 py-16">
          <div className="page-shell max-w-3xl">
            <Badge variant="muted" className="mb-4">Contact</Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Let&apos;s get your institution scanning
            </h1>
            <p className="mt-4 text-muted-foreground">
              Questions about onboarding, imports, semester billing or a pilot?
              Send us a message and we will respond within one business day.
            </p>
          </div>
        </section>

        <section className="py-14">
          <div className="page-shell grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardContent className="p-6 sm:p-8">
                <h2 className="font-display text-lg font-semibold">Send a message</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Messages are stored as support tickets and routed to the platform team.
                </p>
                <div className="mt-6">
                  <ContactForm />
                </div>
              </CardContent>
            </Card>
            <div className="space-y-3">
              {[
                { icon: Mail, title: "Email", body: "support@maideenattendee.app", sub: "For onboarding and technical support." },
                { icon: MessageSquare, title: "In-app support", body: "Available after sign-in", sub: "Institution administrators can open tickets directly." },
                { icon: Clock, title: "Hours", body: "Mon–Fri, 9:00–17:00 WAT", sub: "Critical payment issues are monitored daily." },
                { icon: MapPin, title: "Operating from", body: "Lagos, Nigeria", sub: "Serving institutions across West Africa." },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-xl border bg-card p-5">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.title}</p>
                    <p className="mt-1 text-sm font-medium">{item.body}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
