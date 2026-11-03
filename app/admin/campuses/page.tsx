import { MapPin, Pencil, Plus } from "lucide-react";

import { DeleteButton } from "@/components/admin/delete-button";
import { EntityDialog } from "@/components/admin/entity-dialog";
import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteCampus, saveCampus } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function CampusesPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { data: campuses } = await supabase
    .from("campuses")
    .select("id, name, address, is_main, created_at")
    .eq("institution_id", institutionId)
    .order("is_main", { ascending: false })
    .order("name");

  return (
    <div className="page-shell">
      <PageHeader
        title="Campuses"
        description="Record the physical campuses your institution operates. Campuses are useful for institution-wide reporting."
        actions={
          <EntityDialog
            triggerLabel="Add campus"
            triggerIcon={<Plus />}
            title="Add a campus"
            fields={[
              { name: "name", label: "Campus name", required: true, placeholder: "Main Campus", full: true },
              { name: "address", label: "Address", type: "textarea", placeholder: "Street, city, state", full: true },
              { name: "is_main", label: "Main campus", type: "switch" },
            ]}
            action={saveCampus}
          />
        }
      />

      {campuses && campuses.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campus</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campuses.map((campus) => (
                <TableRow key={campus.id}>
                  <TableCell className="font-medium">{campus.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {campus.address ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={campus.is_main ? "success" : "muted"}>
                      {campus.is_main ? "Main" : "Branch"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(campus.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <EntityDialog
                        triggerLabel="Edit"
                        triggerIcon={<Pencil />}
                        triggerVariant="ghost"
                        triggerSize="icon-sm"
                        title="Edit campus"
                        fields={[
                          { name: "name", label: "Campus name", required: true, defaultValue: campus.name, full: true },
                          { name: "address", label: "Address", type: "textarea", defaultValue: campus.address ?? "", full: true },
                          { name: "is_main", label: "Main campus", type: "switch", defaultValue: campus.is_main ? 1 : 0 },
                        ]}
                        hiddenValues={{ id: campus.id }}
                        action={saveCampus}
                      />
                      <DeleteButton
                        action={deleteCampus}
                        id={campus.id}
                        title="Delete campus?"
                        description="This only removes the campus record. Attendance data is not affected."
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={MapPin} title="No campuses yet" description="Add your main campus first." />
      )}
    </div>
  );
}
