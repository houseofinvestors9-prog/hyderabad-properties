/**
 * Sends a one-time login code on WhatsApp through Gallabox, using an approved Authentication template.
 *
 * Env:
 *   GALLABOX_API_KEY, GALLABOX_API_SECRET   Gallabox > Settings > API keys
 *   GALLABOX_CHANNEL_ID                     the WhatsApp channel the code is sent from
 *   GALLABOX_OTP_TEMPLATE                   name of the approved Authentication template (Copy Code button)
 *
 * Gallabox fills an Authentication template from one value named `otp`, which WhatsApp puts in the body
 * and in the Copy Code button.
 */

const ENDPOINT = 'https://server.gallabox.com/devapi/messages/whatsapp';

export function whatsappOtpConfigured(): boolean {
  return !!(
    process.env.GALLABOX_API_KEY &&
    process.env.GALLABOX_API_SECRET &&
    process.env.GALLABOX_CHANNEL_ID &&
    process.env.GALLABOX_OTP_TEMPLATE
  );
}

/** "+919876543210" -> "919876543210": Gallabox takes the number with country code, no plus. */
function gallaboxPhone(e164: string): string {
  return e164.replace(/^\+/, '');
}

export async function sendWhatsappOtp(phoneE164: string, code: string): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apiKey: process.env.GALLABOX_API_KEY!,
      apiSecret: process.env.GALLABOX_API_SECRET!,
    },
    body: JSON.stringify({
      channelId: process.env.GALLABOX_CHANNEL_ID,
      channelType: 'whatsapp',
      recipient: { name: 'Buyer', phone: gallaboxPhone(phoneE164) },
      whatsapp: {
        type: 'template',
        template: {
          templateName: process.env.GALLABOX_OTP_TEMPLATE,
          bodyValues: { otp: code },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Gallabox ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
