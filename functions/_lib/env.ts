/** Bindings and settings for the booking functions (wrangler.toml + secrets). */
export interface Env {
  DB: D1Database;
  /** Server-side Google key: Places API (New) + Routes API. Secret. */
  GOOGLE_MAPS_API_KEY?: string;
  /** HMAC key for signing quotes. Secret. */
  QUOTE_SECRET?: string;
  /** Cloudflare API token with Email Sending permission. Secret, optional. */
  CF_EMAIL_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  BOOKING_ALERT_TO?: string;
  BOOKING_EMAIL_FROM?: string;
  /** Twilio, for dispatch texts. Secrets. TWILIO_FROM is a +1 number or a Messaging Service SID (MG…). */
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM?: string;
  /** Base URL for driver accept links, e.g. https://boxhauls.com */
  PUBLIC_SITE_URL?: string;
  /** Local development only (.dev.vars): fake places and distances so the flow can be tested without Google. */
  DEV_MOCK_MAPS?: string;
  /** Local development only (.dev.vars): log texts to the console instead of sending them. */
  DEV_MOCK_SMS?: string;
}
