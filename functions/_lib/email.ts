/**
 * Booking emails via the Cloudflare Email Sending REST API.
 * Sends only when CF_EMAIL_API_TOKEN is set and the from-domain is onboarded to Email Sending;
 * otherwise the booking is still saved and alert_status records why no email went out.
 */
import type { Env } from './env';

export type AlertStatus = 'sent' | 'skipped' | 'failed';

interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

async function send(env: Env, m: Message): Promise<boolean> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: m.to,
      from: { address: env.BOOKING_EMAIL_FROM, name: 'BoxHauls' },
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      subject: m.subject,
      text: m.text,
      html: m.html,
    }),
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; result?: { permanent_bounces?: string[] } } | null;
  if (!res.ok || !body?.success || body.result?.permanent_bounces?.length) {
    console.error('email send failed', res.status, JSON.stringify(body));
    return false;
  }
  return true;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const table = (rows: [string, string][]) =>
  `<table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows
    .map(([k, v]) => `<tr><th align="left" style="border-bottom:1px solid #ddd">${esc(k)}</th><td style="border-bottom:1px solid #ddd">${esc(v)}</td></tr>`)
    .join('')}</table>`;

export interface BookingSummary {
  id: string;
  name: string;
  phone: string;
  email: string;
  pickup: string;
  dropoff: string;
  miles: number;
  item: string;
  tier: string;
  helper: boolean;
  total: string;
  when: string;
  notes: string;
}

/** Alert to BoxHauls, plus a receipt to the customer. Returns the status for the alert. */
export async function sendBookingEmails(env: Env, b: BookingSummary): Promise<AlertStatus> {
  if (!env.CF_EMAIL_API_TOKEN || !env.CF_ACCOUNT_ID || !env.BOOKING_EMAIL_FROM || !env.BOOKING_ALERT_TO) return 'skipped';
  const rows: [string, string][] = [
    ['Reference', b.id],
    ['When', b.when],
    ['Pickup', b.pickup],
    ['Drop-off', b.dropoff],
    ['Distance', `${b.miles.toFixed(1)} miles`],
    ['Item', b.item],
    ['Job type', b.tier],
    ['Helper requested', b.helper ? 'Yes (not guaranteed)' : 'No'],
    ['Quoted price', `${b.total} (plus dump fees at cost, if any)`],
    ['Customer', b.name],
    ['Phone', b.phone],
    ['Email', b.email],
    ['Notes', b.notes || '—'],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');

  const alertOk = await send(env, {
    to: env.BOOKING_ALERT_TO,
    replyTo: b.email,
    subject: `New booking ${b.id}: ${b.item}, ${b.when}`,
    text: `New web booking.\n\n${text}`,
    html: `<p>New web booking.</p>${table(rows)}`,
  });

  const customerRows = rows.filter(([k]) => !['Customer', 'Phone', 'Email'].includes(k));
  await send(env, {
    to: b.email,
    replyTo: env.BOOKING_ALERT_TO,
    subject: `BoxHauls booking request ${b.id}`,
    text: `Thanks, ${b.name}. We received your booking request.\n\n${customerRows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nBoxHauls will contact you at ${b.phone} to confirm.`,
    html: `<p>Thanks, ${esc(b.name)}. We received your booking request.</p>${table(customerRows)}<p>BoxHauls will contact you at ${esc(b.phone)} to confirm.</p>`,
  });

  return alertOk ? 'sent' : 'failed';
}
