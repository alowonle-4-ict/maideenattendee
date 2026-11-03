import { NextResponse, type NextRequest } from "next/server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { env, isSupabaseConfigured } from "@/lib/env";
import type { AppRole } from "@/lib/types";

const ROUTE_ROLES: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/platform", roles: ["super_admin"] },
  { prefix: "/admin", roles: ["institution_admin"] },
  { prefix: "/lecturer", roles: ["lecturer"] },
  { prefix: "/student", roles: ["student"] },
];

const PUBLIC_PREFIXES = [
  "/",
  "/about",
  "/features",
  "/pricing",
  "/contact",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/auth",
  "/api/webhooks",
  "/api/payments",
  "/api/health",
  "/offline",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons",
];

export function homeForRole(role: AppRole | null): string {
  switch (role) {
    case "super_admin":
      return "/platform";
    case "institution_admin":
      return "/admin";
    case "lecturer":
      return "/lecturer";
    case "student":
      return "/student";
    default:
      return "/login";
  }
}

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => prefix !== "/" && pathname.startsWith(prefix)
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const guarded = ROUTE_ROLES.find((route) => pathname.startsWith(route.prefix));

  if (!user) {
    if (guarded) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(new URL("/auth/redirect", request.url));
  }

  if (guarded) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = (roleRow?.role as AppRole | undefined) ?? null;

    if (!role || !guarded.roles.includes(role)) {
      const url = request.nextUrl.clone();
      url.pathname = role ? homeForRole(role) : "/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
