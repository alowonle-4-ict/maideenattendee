import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Reset your password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the email associated with your account and we will send a secure
        reset link.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
