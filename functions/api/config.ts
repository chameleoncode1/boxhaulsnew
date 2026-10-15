/** GET /api/config — public settings the booking widget needs at runtime (the Stripe publishable key). */
import type { Env } from '../_lib/env';
import { json } from '../_lib/http';

export const onRequestGet: PagesFunction<Env> = ({ env }) => json({ stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null });
