-- Dump runs: what's in the load, how much, and the dump-fee part of the hold (the most the driver can enter).
ALTER TABLE bookings ADD COLUMN dump_material TEXT;
ALTER TABLE bookings ADD COLUMN dump_load TEXT;
ALTER TABLE bookings ADD COLUMN dump_hold_cents INTEGER;
-- Who canceled: customer | driver | no_show (customer reported the driver didn't show)
ALTER TABLE bookings ADD COLUMN cancel_reason TEXT;
