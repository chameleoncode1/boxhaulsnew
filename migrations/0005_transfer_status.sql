-- Driver payouts can fail after the customer is charged (e.g. the driver's Stripe account needs attention).
-- The charge stands; the transfer is recorded as failed and retried by the dispatch cron.
ALTER TABLE bookings ADD COLUMN transfer_status TEXT;   -- sent | failed | none
ALTER TABLE bookings ADD COLUMN transfer_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN transfer_charge_id TEXT; -- charge the transfer is funded from
