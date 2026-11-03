import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { SubscriptionPlan } from "@/lib/types";

export const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    slug: "starter",
    description: "For small departments and independent lecturers.",
    price_ngn: 25000,
    billing_cycle: "monthly",
    max_students: 100,
    max_lecturers: 5,
    max_courses: 20,
    features: ["QR attendance", "Basic dashboard", "Excel exports", "Email support"],
    is_active: true,
    sort_order: 10,
  },
  {
    id: "basic",
    name: "Basic",
    slug: "basic",
    description: "For growing institutions that need offline attendance.",
    price_ngn: 75000,
    billing_cycle: "monthly",
    max_students: 500,
    max_lecturers: 30,
    max_courses: 100,
    features: [
      "Everything in Starter",
      "Offline attendance",
      "Real-time dashboards",
      "Course registers",
      "Priority support",
    ],
    is_active: true,
    sort_order: 20,
  },
  {
    id: "professional",
    name: "Professional",
    slug: "professional",
    description: "For established institutions with multiple departments.",
    price_ngn: 200000,
    billing_cycle: "monthly",
    max_students: 2000,
    max_lecturers: 100,
    max_courses: 400,
    features: [
      "Everything in Basic",
      "Department management",
      "Advanced analytics",
      "Offline synchronization",
      "Advanced reporting",
    ],
    is_active: true,
    sort_order: 30,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    slug: "enterprise",
    description: "For large institutions and multi-campus groups.",
    price_ngn: 1800000,
    billing_cycle: "annual",
    max_students: 5000,
    max_lecturers: 300,
    max_courses: 1000,
    features: [
      "Everything in Professional",
      "Multiple campuses",
      "White-label branding",
      "Priority support",
      "Custom integrations",
    ],
    is_active: true,
    sort_order: 40,
  },
];

export async function getPublicPlans(): Promise<SubscriptionPlan[]> {
  if (!isSupabaseConfigured()) return FALLBACK_PLANS;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (!data || data.length === 0) return FALLBACK_PLANS;
    return data.map((plan) => ({
      ...plan,
      features: Array.isArray(plan.features) ? plan.features : [],
    })) as SubscriptionPlan[];
  } catch {
    return FALLBACK_PLANS;
  }
}

export function billingLabel(cycle: SubscriptionPlan["billing_cycle"]) {
  return {
    monthly: "per month",
    semester: "per semester",
    annual: "per year",
    custom: "custom",
  }[cycle];
}
