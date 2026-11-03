import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Set a new password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose a strong password you have not used elsewhere.
      </p>
      <div className="mt-6">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
