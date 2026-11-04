import { InstitutionLogoForm } from "@/components/admin/institution-logo-form";
import { InstitutionSettingsForm } from "@/components/admin/institution-settings-form";
import { PageHeader, SectionCard } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function AdminSettingsPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: institution }, { data: settings }] = await Promise.all([
    supabase
      .from("institutions")
      .select("name, slug, email, phone, address, logo_url, status, created_at")
      .eq("id", institutionId)
      .maybeSingle(),
    supabase.from("institution_settings").select("*").eq("institution_id", institutionId).maybeSingle(),
  ]);

  const values = {
    attendance_threshold: settings?.attendance_threshold ?? 75,
    late_after_minutes: settings?.late_after_minutes ?? 15,
    allow_manual_qr: settings?.allow_manual_qr ?? true,
    timezone: settings?.timezone ?? "Africa/Lagos",
    grace_period_days: settings?.grace_period_days ?? 7,
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Institution settings"
        description="Configure attendance rules and institutional preferences. Changes apply to future scans."
      />

      <SectionCard
        title="Institution logo"
        description="Shown in the dashboard header for your administrators, lecturers and students."
        className="mb-6"
      >
        <InstitutionLogoForm logoUrl={institution?.logo_url ?? null} />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Attendance rules" description="These values drive late detection and reporting thresholds.">
            <InstitutionSettingsForm values={values} />
          </SectionCard>
        </div>

        <SectionCard title="Institution profile">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Name</dt>
              <dd className="mt-0.5 font-medium">{institution?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Institution URL</dt>
              <dd className="mt-0.5 font-mono text-xs">{institution?.slug ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <Badge variant={institution?.status === "active" ? "success" : "warning"} className="capitalize">
                  {institution?.status ?? "pending"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Contact email</dt>
              <dd className="mt-0.5 break-all">{institution?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Phone</dt>
              <dd className="mt-0.5">{institution?.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Address</dt>
              <dd className="mt-0.5 text-muted-foreground">{institution?.address ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Registered</dt>
              <dd className="mt-0.5">{formatDate(institution?.created_at)}</dd>
            </div>
          </dl>
          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            Institution name and contact details are managed by the platform administrator. Contact
            support if they need to be changed.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
