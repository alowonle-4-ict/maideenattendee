import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { QrCard } from "@/components/admin/qr-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StudentQrPage() {
  const ctx = await requireAuth(["student"]);
  const supabase = await createClient();

  const [{ data: credential }, { data: institution }] = await Promise.all([
    supabase
      .from("student_qr_credentials")
      .select("token, status, created_at")
      .eq("student_id", ctx.user.id)
      .eq("status", "active")
      .maybeSingle(),
    ctx.institutionId
      ? supabase.from("institutions").select("name").eq("id", ctx.institutionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="page-shell max-w-4xl">
      <PageHeader
        title="My QR code"
        description="This is your permanent student credential. Present it to your lecturer at the start of class so they can scan you in."
        actions={
          <Button asChild variant="outline">
            <Link href="/student">Back to dashboard</Link>
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-[minmax(0,360px)_1fr]">
        <div>
          {credential ? (
            <QrCard
              token={credential.token}
              name={ctx.profile?.full_name ?? "Student"}
              matric={ctx.profile?.matric_number}
              institutionName={institution?.name ?? "Institution"}
            />
          ) : (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-6 text-center text-sm text-warning">
              <AlertTriangle className="mx-auto mb-3 h-6 w-6" />
              <p className="font-medium">No active QR credential</p>
              <p className="mt-1 text-xs">
                Contact your institution administrator. They can issue a new credential from the students page.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <p className="flex items-center gap-2 font-display text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-success" /> Your credential is permanent
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• The same QR code works for every course and every class.</li>
              <li>• It contains a random token — no name, matric number or personal data.</li>
              <li>• Only your lecturers can scan it, and every scan is validated by the server.</li>
              <li>• If you lose your printed copy, download or print it again here.</li>
            </ul>
          </div>

          <div className="rounded-xl border bg-muted/30 p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Printing for your ID card</p>
            <p className="mt-1.5">
              Use the Print button to open a print-friendly card with your name, matric number and
              institution. The QR image downloads as a PNG at high resolution for ID card printing.
            </p>
          </div>

          <div className="rounded-xl border bg-muted/30 p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">If your code is compromised</p>
            <p className="mt-1.5">
              Ask an administrator to regenerate your credential. Your previous code is revoked
              immediately and a new, unique code is issued.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
