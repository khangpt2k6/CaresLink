import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }
  if (!client) {
    client = twilio(accountSid, authToken);
  }
  return client;
}

export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!fromNumber) {
      throw new Error("TWILIO_PHONE_NUMBER must be set");
    }
    const c = getClient();
    await c.messages.create({ body, from: fromNumber, to });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Twilio SMS error:", msg);
    return { success: false, error: msg };
  }
}
