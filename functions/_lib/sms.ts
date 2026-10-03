/**
 * Text messages via Twilio's Messages API. Local development (DEV_MOCK_SMS=1, no Twilio credentials) logs
 * the message to the console instead of sending it.
 */
import type { Env } from './env';

export function smsConfigured(env: Env): boolean {
  return Boolean((env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) || env.DEV_MOCK_SMS === '1');
}

/** Send one text. Returns true when Twilio accepted it (or the mock logged it). */
export async function sendSms(env: Env, to: string, body: string): Promise<boolean> {
  if (!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)) {
    if (env.DEV_MOCK_SMS === '1') {
      console.log(`[mock sms] to ${to}: ${body}`);
      return true;
    }
    return false;
  }
  const form = new URLSearchParams({ To: to, Body: body });
  form.set(env.TWILIO_FROM.startsWith('MG') ? 'MessagingServiceSid' : 'From', env.TWILIO_FROM);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!res.ok) {
    console.error('twilio send failed', res.status, await res.text());
    return false;
  }
  return true;
}

/** "(559) 555-0100" → "+15595550100". */
export function toE164(usPhone: string): string {
  const d = usPhone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return `+1${d}`;
}
