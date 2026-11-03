"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  institution: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10, "Tell us a little more").max(4000),
  website: z.string().max(0).optional(),
});

export interface ContactState {
  ok: boolean;
  message: string;
}

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    institution: formData.get("institution") || undefined,
    message: formData.get("message"),
    website: formData.get("website") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  }

  if (parsed.data.website) {
    return { ok: true, message: "Thank you — we will be in touch." };
  }

  if (!env.serviceRole) {
    return {
      ok: false,
      message: `Email us directly at ${env.appUrl.includes("localhost") ? "support@maideenattendee.app" : "support@maideenattendee.app"} while support routing is being configured.`,
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("support_tickets").insert({
      subject: `Website enquiry — ${parsed.data.name}`,
      body: `From: ${parsed.data.name} <${parsed.data.email}>\nInstitution: ${
        parsed.data.institution ?? "Not provided"
      }\n\n${parsed.data.message}`,
      priority: "normal",
      status: "open",
    });
    if (error) throw error;
    return {
      ok: true,
      message:
        "Thank you. Your message has been logged and our team will respond within one business day.",
    };
  } catch {
    return {
      ok: false,
      message:
        "We could not submit the form right now. Please email support@maideenattendee.app.",
    };
  }
}
