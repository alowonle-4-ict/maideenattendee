export type GatewayName = "paystack" | "flutterwave";

export type GatewayPaymentState = "success" | "pending" | "failed" | "abandoned" | "unknown";

export interface InitializePaymentInput {
  reference: string;
  amountNgn: number;
  email: string;
  customerName?: string | null;
  planName: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
  gatewayReference: string | null;
}

export interface VerifiedPayment {
  gateway: GatewayName;
  reference: string;
  gatewayReference: string | null;
  amountNgn: number;
  currency: string;
  state: GatewayPaymentState;
  channel: string | null;
  paidAt: string | null;
  failureReason: string | null;
  raw: unknown;
}

export type GatewayCredentialSource = "stored" | "environment" | "none";

export type GatewayKeyMode = "test" | "live" | "unknown";

export interface GatewayAvailability {
  gateway: GatewayName;
  label: string;
  configured: boolean;
  enabled: boolean;
  missing: string[];
  source: GatewayCredentialSource;
  keyMode: GatewayKeyMode;
}

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    readonly gateway: GatewayName,
    readonly statusCode?: number
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}
