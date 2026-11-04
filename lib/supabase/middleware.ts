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

function loginWithNotice(request: NextRequest, notice: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("notice", notice);
  return NextResponse.redirect(url);
}

function isAuthOutage(
  error: { name?: string; message?: string; status?: number } | null
) {
  if (!error) return false;
  return (
    error.name === "AuthRetryableFetchError" ||
    (error.status ?? 0) >= 500 ||
    /invalid api key/i.test(error.message ?? "")
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  const guarded = ROUTE_ROLES.find((route) => pathname.startsWith(route.prefix));

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

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (isAuthOutage(authError)) {
      return guarded ? loginWithNotice(request, "auth_unavailable") : response;
    }

    if (!user) {
      if (guarded) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
      return response;
    }

    // Only bounce away from /login when the account actually has a role. A stale
    // session without a user_roles row would otherwise loop /login -> /auth/redirect.
    if (pathname === "/login" || pathname === "/register") {
      const { data: roleRow, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const role = !error && roleRow?.role ? (roleRow.role as AppRole) : null;
      if (!role) return response;

      const url = request.nextUrl.clone();
      url.pathname = homeForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (guarded) {
      const { data: roleRow, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const role = !error && roleRow?.role ? (roleRow.role as AppRole) : null;

      if (!role) {
        return loginWithNotice(request, error ? "auth_unavailable" : "no_role");
      }

      if (!guarded.roles.includes(role)) {
        const url = request.nextUrl.clone();
        url.pathname = homeForRole(role);
        url.search = "";
        return NextResponse.redirect(url);
      }
    }

    return response;
  } catch {
    if (guarded) {
      return loginWithNotice(request, "auth_unavailable");
    }
    return response;
  }
}
