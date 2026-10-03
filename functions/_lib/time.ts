/** Fresno (America/Los_Angeles) date and time helpers for scheduling and dispatch deadlines. */
const TZ = 'America/Los_Angeles';

/** Today's date in Fresno as YYYY-MM-DD. */
export function fresnoToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
}

/** UTC instant for a Fresno wall-clock date + "HH:MM" (handles PDT/PST). */
export function fresnoInstant(date: string, hhmm: string): Date {
  const guess = new Date(`${date}T${hhmm}:00Z`);
  // Offset of Fresno from UTC at that moment, in minutes (e.g. -420 in summer).
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(guess);
  const off = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-08:00';
  const m = off.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  const minutes = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : -480;
  return new Date(guess.getTime() - minutes * 60_000);
}

/** "Mon, Oct 6" for a YYYY-MM-DD date. */
export function shortDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`));
}
