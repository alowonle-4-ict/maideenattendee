import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { gatewayConfigIssues } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "maideenattendee",
    supabase: Boolean(env.supabaseUrl && env.supabaseAnonKey),
    serviceRole: Boolean(env.serviceRole),
    gateways: {
      paystack: gatewayConfigIssues("paystack").length === 0,
      flutterwave: gatewayConfigIssues("flutterwave").length === 0,
    },
  });
}
