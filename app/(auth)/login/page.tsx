import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  no_role:
    "This account is signed in but has no role assigned. Contact your institution administrator, then sign in again.",
  auth_unavailable:
    "We couldn't reach the authentication service. This is usually a database setup problem — try again in a moment, or contact your administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const params = await searchParams;
  const noticeKey = typeof params.notice === "string" ? params.notice : "";

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your institution, lecturer or student account.
        </p>
      </div>
      <LoginForm notice={NOTICES[noticeKey]} />
    </div>
  );
}
