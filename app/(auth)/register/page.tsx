import { getPublicPlans } from "@/lib/plans";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create your institution" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const plans = await getPublicPlans();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Create your institution
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up a tenant, become its administrator, and start a 14-day trial.
        </p>
      </div>
      <RegisterForm
        plans={plans.map((item) => ({
          slug: item.slug,
          name: item.name,
          price_ngn: Number(item.price_ngn),
        }))}
        defaultPlan={plan}
      />
    </div>
  );
}
