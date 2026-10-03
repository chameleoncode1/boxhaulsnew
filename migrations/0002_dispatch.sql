-- Auto-dispatch: approved drivers, per-driver job offers, and dispatch state on bookings.
CREATE TABLE drivers (
  id          TEXT PRIMARY KEY,               -- e.g. DRV-4K7Q
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL UNIQUE,           -- E.164, e.g. +15595550100
  has_helper  INTEGER NOT NULL DEFAULT 0,     -- 1: can take helper-requested jobs
  active      INTEGER NOT NULL DEFAULT 1,     -- 0: no new offers
  created_at  TEXT NOT NULL
);

CREATE TABLE offers (
  booking_id  TEXT NOT NULL REFERENCES bookings(id),
  driver_id   TEXT NOT NULL REFERENCES drivers(id),
  token_hash  TEXT NOT NULL UNIQUE,           -- SHA-256 of the accept-link token; the raw token is only in the text
  sent_at     TEXT NOT NULL,
  sms_status  TEXT NOT NULL DEFAULT 'pending',-- sent | failed
  PRIMARY KEY (booking_id, driver_id)
);

-- status now: dispatching | assigned | unfilled | canceled | completed ('new' kept for rows created before dispatch)
ALTER TABLE bookings ADD COLUMN driver_id TEXT REFERENCES drivers(id);
ALTER TABLE bookings ADD COLUMN assigned_at TEXT;
ALTER TABLE bookings ADD COLUMN dispatch_expires_at TEXT;
ALTER TABLE bookings ADD COLUMN customer_sms_status TEXT NOT NULL DEFAULT 'pending';
CREATE INDEX bookings_dispatching ON bookings (status, dispatch_expires_at);
