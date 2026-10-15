-- Payments (Stripe): card authorized at request, captured on completion, split to the driver via Stripe Connect.
-- Booking status: pending_payment → dispatching → assigned → completed | canceled | unfilled | abandoned
ALTER TABLE bookings ADD COLUMN payment_intent_id TEXT;
ALTER TABLE bookings ADD COLUMN authorized_cents INTEGER;            -- hold amount (trip + dump buffer on dump runs)
ALTER TABLE bookings ADD COLUMN confirmed_at TEXT;                   -- card authorized; starts the free-cancel window
ALTER TABLE bookings ADD COLUMN customer_token_hash TEXT;            -- SHA-256 of the customer's manage-trip link token
ALTER TABLE bookings ADD COLUMN dump_fee_cents INTEGER;              -- entered by the driver at completion
ALTER TABLE bookings ADD COLUMN captured_cents INTEGER;              -- amount actually charged
ALTER TABLE bookings ADD COLUMN driver_transfer_cents INTEGER;       -- amount sent to the driver
ALTER TABLE bookings ADD COLUMN transfer_id TEXT;
ALTER TABLE bookings ADD COLUMN completed_at TEXT;
ALTER TABLE bookings ADD COLUMN canceled_at TEXT;
ALTER TABLE bookings ADD COLUMN cancel_fee_cents INTEGER;
CREATE UNIQUE INDEX bookings_customer_token ON bookings (customer_token_hash);
CREATE INDEX bookings_payment_intent ON bookings (payment_intent_id);

ALTER TABLE drivers ADD COLUMN stripe_account_id TEXT;               -- Stripe Connect Express account
ALTER TABLE drivers ADD COLUMN payouts_ready INTEGER NOT NULL DEFAULT 0; -- 1 once Stripe can send this driver transfers
ALTER TABLE drivers ADD COLUMN onboarding_token_hash TEXT;           -- SHA-256 of the driver's payouts-setup link token
