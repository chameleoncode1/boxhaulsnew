-- Web booking requests. One row per submitted booking. No payment data is stored (none is taken online).
CREATE TABLE bookings (
  id               TEXT PRIMARY KEY,            -- reference shown to the customer, e.g. BH-7K3QX2
  created_at       TEXT NOT NULL,               -- ISO 8601, UTC
  status           TEXT NOT NULL DEFAULT 'new', -- new | confirmed | completed | canceled
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT NOT NULL,
  pickup_address   TEXT NOT NULL,
  pickup_place_id  TEXT NOT NULL,
  dropoff_address  TEXT NOT NULL,
  dropoff_place_id TEXT NOT NULL,
  miles            REAL NOT NULL,
  item             TEXT NOT NULL,
  tier             TEXT NOT NULL,
  helper           INTEGER NOT NULL,            -- 0/1: helper requested (not guaranteed)
  heavy            INTEGER NOT NULL,            -- 0/1: heavy-item fee applied
  price_cents      INTEGER NOT NULL,            -- quoted total, before dump fees
  when_type        TEXT NOT NULL,               -- asap | scheduled
  scheduled_date   TEXT,                        -- YYYY-MM-DD when scheduled
  scheduled_window TEXT,                        -- e.g. "10 AM–12 PM" when scheduled
  notes            TEXT,
  ip_hash          TEXT NOT NULL,               -- salted hash, for rate limiting only
  alert_status     TEXT NOT NULL DEFAULT 'pending' -- sent | skipped | failed
);
CREATE INDEX bookings_created_at ON bookings (created_at);
CREATE INDEX bookings_ip_recent ON bookings (ip_hash, created_at);
