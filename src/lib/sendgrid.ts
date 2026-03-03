import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!resend) {
      throw new Error("RESEND_API_KEY not set");
    }

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html: html || text.replace(/\n/g, "<br>"),
      text,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Resend error:", msg);
    return { success: false, error: msg };
  }
}
