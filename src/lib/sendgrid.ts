import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL || "recruit@example.com";

export function initSendGrid() {
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY not set - email sending disabled");
    return false;
  }
  sgMail.setApiKey(apiKey);
  return true;
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiKey) {
      throw new Error("SENDGRID_API_KEY must be set");
    }
    sgMail.setApiKey(apiKey);

    await sgMail.send({
      to,
      from: fromEmail,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("SendGrid error:", msg);
    return { success: false, error: msg };
  }
}
