import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { gatewayConfigIssues } from "@/lib/payments";
import { resolveGatewaySecrets } from "@/lib/secrets/gateways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const secrets = await resolveGatewaySecrets();
  return NextResponse.json({
    ok: true,
    app: "maideenattendee",
    supabase: Boolean(env.supabaseUrl && env.supabaseAnonKey),
    serviceRole: Boolean(env.serviceRole),
    gateways: {
      paystack: gatewayConfigIssues("paystack", secrets).length === 0,
      flutterwave: gatewayConfigIssues("flutterwave", secrets).length === 0,
    },
  });
}
