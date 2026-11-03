const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  paystackSecret: process.env.PAYSTACK_SECRET_KEY ?? "",
  paystackPublic: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "",
  flutterwaveSecret: process.env.FLUTTERWAVE_SECRET_KEY ?? "",
  flutterwavePublic: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "",
  flutterwaveHash: process.env.FLUTTERWAVE_SECRET_HASH ?? "",
  serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function isPaystackConfigured() {
  return Boolean(env.paystackSecret && env.paystackPublic);
}

export function isFlutterwaveConfigured() {
  return Boolean(env.flutterwaveSecret && env.flutterwavePublic && env.flutterwaveHash);
}

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }
}
