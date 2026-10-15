-- Accounts for both apps (customer site + BoxHauls Driver), sessions, phone codes, driver records and documents,
-- driver progress on trips, online status, and tips.
-- Sensitive data policy (decided 2026-10-15): BoxHauls never stores full SSNs or bank numbers. Stripe Connect
-- collects tax ID and bank details; the background-check provider collects SSN. Only statuses and last 4 digits here.

-- ───────────────────────── Customers ─────────────────────────
CREATE TABLE customers (
  id                     TEXT PRIMARY KEY,              -- CUS-XXXXXX
  status                 TEXT NOT NULL DEFAULT 'active',-- active | suspended | deleted
  first_name             TEXT,
  last_name              TEXT,
  email                  TEXT UNIQUE,                   -- lowercase; NULL once deleted
  email_verified_at      TEXT,
  phone                  TEXT UNIQUE,                   -- E.164; NULL once deleted
  phone_verified_at      TEXT,
  password_hash          TEXT,                          -- PBKDF2-SHA256, "iterations$salt$hash" (base64)
  preferred_language     TEXT NOT NULL DEFAULT 'en',
  home_address           TEXT,                          -- saved places
  home_place_id          TEXT,
  work_address           TEXT,
  work_place_id          TEXT,
  stripe_customer_id     TEXT,                          -- cards live in Stripe; BoxHauls never sees card numbers
  default_card_brand     TEXT,
  default_card_last4     TEXT,
  default_card_exp       TEXT,                          -- MM/YY
  sms_opt_in             INTEGER NOT NULL DEFAULT 1,    -- trip texts
  marketing_email_opt_in INTEGER NOT NULL DEFAULT 0,
  marketing_sms_opt_in   INTEGER NOT NULL DEFAULT 0,
  terms_accepted_at      TEXT,
  terms_version          TEXT,
  privacy_accepted_at    TEXT,
  rating_avg             REAL,                          -- ratings drivers give the customer (none collected yet)
  rating_count           INTEGER NOT NULL DEFAULT 0,
  referral_code          TEXT UNIQUE,
  referred_by            TEXT,
  signup_source          TEXT,                          -- web | app | booking
  signup_ip_hash         TEXT,
  last_login_at          TEXT,
  last_login_ip_hash     TEXT,
  last_user_agent        TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  deleted_at             TEXT
);

-- ───────────────────────── Drivers (extends 0002/0003) ─────────────────────────
ALTER TABLE drivers ADD COLUMN application_status TEXT NOT NULL DEFAULT 'approved'; -- applying | submitted | approved | rejected | suspended | deactivated | deleted (rows from the CLI are pre-approved)
ALTER TABLE drivers ADD COLUMN app_user INTEGER NOT NULL DEFAULT 0;          -- 1: signed up in BoxHauls Driver
ALTER TABLE drivers ADD COLUMN first_name TEXT;
ALTER TABLE drivers ADD COLUMN last_name TEXT;
ALTER TABLE drivers ADD COLUMN preferred_name TEXT;
ALTER TABLE drivers ADD COLUMN email TEXT;
ALTER TABLE drivers ADD COLUMN email_verified_at TEXT;
ALTER TABLE drivers ADD COLUMN phone_verified_at TEXT;
ALTER TABLE drivers ADD COLUMN password_hash TEXT;
ALTER TABLE drivers ADD COLUMN date_of_birth TEXT;                           -- YYYY-MM-DD
ALTER TABLE drivers ADD COLUMN address_line1 TEXT;
ALTER TABLE drivers ADD COLUMN address_line2 TEXT;
ALTER TABLE drivers ADD COLUMN city TEXT;
ALTER TABLE drivers ADD COLUMN state TEXT;
ALTER TABLE drivers ADD COLUMN postal_code TEXT;
ALTER TABLE drivers ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE drivers ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE drivers ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'en';
-- Driver's license
ALTER TABLE drivers ADD COLUMN license_number TEXT;
ALTER TABLE drivers ADD COLUMN license_state TEXT;
ALTER TABLE drivers ADD COLUMN license_expiry TEXT;
-- Vehicle
ALTER TABLE drivers ADD COLUMN vehicle_year INTEGER;
ALTER TABLE drivers ADD COLUMN vehicle_make TEXT;
ALTER TABLE drivers ADD COLUMN vehicle_model TEXT;
ALTER TABLE drivers ADD COLUMN vehicle_color TEXT;
ALTER TABLE drivers ADD COLUMN vehicle_plate TEXT;
ALTER TABLE drivers ADD COLUMN vehicle_plate_state TEXT;
ALTER TABLE drivers ADD COLUMN vehicle_vin TEXT;
ALTER TABLE drivers ADD COLUMN bed_length TEXT;                              -- e.g. 6.5 ft
ALTER TABLE drivers ADD COLUMN registration_expiry TEXT;
-- Insurance
ALTER TABLE drivers ADD COLUMN insurance_carrier TEXT;
ALTER TABLE drivers ADD COLUMN insurance_policy_number TEXT;
ALTER TABLE drivers ADD COLUMN insurance_expiry TEXT;
-- Background check (the provider collects SSN; only status and last 4 here)
ALTER TABLE drivers ADD COLUMN background_consent_at TEXT;
ALTER TABLE drivers ADD COLUMN background_consent_ip_hash TEXT;
ALTER TABLE drivers ADD COLUMN background_status TEXT NOT NULL DEFAULT 'not_started'; -- not_started | consented | pending | clear | consider | suspended
ALTER TABLE drivers ADD COLUMN background_provider TEXT;
ALTER TABLE drivers ADD COLUMN background_report_id TEXT;
ALTER TABLE drivers ADD COLUMN background_checked_at TEXT;
ALTER TABLE drivers ADD COLUMN ssn_last4 TEXT;
-- Tax and payouts (Stripe collects tax ID and bank; this mirrors Stripe's status)
ALTER TABLE drivers ADD COLUMN tax_info_status TEXT;                         -- from Stripe: pending | verified
ALTER TABLE drivers ADD COLUMN bank_last4 TEXT;
-- Agreement and review
ALTER TABLE drivers ADD COLUMN agreement_accepted_at TEXT;
ALTER TABLE drivers ADD COLUMN agreement_version TEXT;
ALTER TABLE drivers ADD COLUMN submitted_at TEXT;
ALTER TABLE drivers ADD COLUMN approved_at TEXT;
ALTER TABLE drivers ADD COLUMN reviewed_by TEXT;
ALTER TABLE drivers ADD COLUMN rejection_reason TEXT;
-- Live status
ALTER TABLE drivers ADD COLUMN online INTEGER NOT NULL DEFAULT 0;
ALTER TABLE drivers ADD COLUMN online_since TEXT;
ALTER TABLE drivers ADD COLUMN last_seen_at TEXT;
ALTER TABLE drivers ADD COLUMN last_lat REAL;
ALTER TABLE drivers ADD COLUMN last_lng REAL;
ALTER TABLE drivers ADD COLUMN nav_app TEXT NOT NULL DEFAULT 'google';     -- google | apple | waze
-- Quality (computed from trips; no ratings are collected yet)
ALTER TABLE drivers ADD COLUMN rating_avg REAL;
ALTER TABLE drivers ADD COLUMN rating_count INTEGER NOT NULL DEFAULT 0;
-- Account
ALTER TABLE drivers ADD COLUMN sms_opt_in INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drivers ADD COLUMN referral_code TEXT;
ALTER TABLE drivers ADD COLUMN signup_ip_hash TEXT;
ALTER TABLE drivers ADD COLUMN last_login_at TEXT;
ALTER TABLE drivers ADD COLUMN last_login_ip_hash TEXT;
ALTER TABLE drivers ADD COLUMN last_user_agent TEXT;
ALTER TABLE drivers ADD COLUMN updated_at TEXT;
ALTER TABLE drivers ADD COLUMN deleted_at TEXT;
CREATE UNIQUE INDEX drivers_email ON drivers (email);
CREATE INDEX drivers_online ON drivers (online, last_seen_at);

-- Driver documents. Images are resized in the browser (≤ 1600 px JPEG) and kept privately in D1.
CREATE TABLE driver_documents (
  id           TEXT PRIMARY KEY,
  driver_id    TEXT NOT NULL REFERENCES drivers(id),
  kind         TEXT NOT NULL,          -- profile_photo | license_front | license_back | registration | insurance_card
  mime         TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  data         BLOB NOT NULL,
  status       TEXT NOT NULL DEFAULT 'submitted', -- submitted | approved | rejected
  review_note  TEXT,
  uploaded_at  TEXT NOT NULL,
  reviewed_at  TEXT
);
CREATE UNIQUE INDEX driver_documents_kind ON driver_documents (driver_id, kind);

-- Online / offline history (hours online, for records and earnings per hour).
CREATE TABLE driver_sessions_online (
  driver_id   TEXT NOT NULL REFERENCES drivers(id),
  started_at  TEXT NOT NULL,
  ended_at    TEXT
);
CREATE INDEX driver_online_log ON driver_sessions_online (driver_id, started_at);

-- Offers a driver declined in the app (so the job stops showing to them).
CREATE TABLE offer_declines (
  booking_id  TEXT NOT NULL REFERENCES bookings(id),
  driver_id   TEXT NOT NULL REFERENCES drivers(id),
  declined_at TEXT NOT NULL,
  PRIMARY KEY (booking_id, driver_id)
);

-- ───────────────────────── Sign-in ─────────────────────────
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,          -- SHA-256 of the cookie value
  user_type   TEXT NOT NULL,             -- customer | driver
  user_id     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  ip_hash     TEXT,
  user_agent  TEXT
);
CREATE INDEX sessions_user ON sessions (user_type, user_id);

-- One-time codes: phone sign-in (when Twilio is live) and password resets.
CREATE TABLE auth_codes (
  id          TEXT PRIMARY KEY,
  user_type   TEXT NOT NULL,
  purpose     TEXT NOT NULL,             -- phone_login | password_reset
  target      TEXT NOT NULL,             -- E.164 phone or email
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);
CREATE INDEX auth_codes_target ON auth_codes (user_type, purpose, target, created_at);

-- Failed sign-ins, for rate limiting.
CREATE TABLE auth_failures (
  key         TEXT NOT NULL,             -- "email:…" or "ip:…" (hashed)
  at          TEXT NOT NULL
);
CREATE INDEX auth_failures_key ON auth_failures (key, at);

-- Account deletions (who and when; no personal data).
CREATE TABLE account_deletions (
  user_type   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  deleted_at  TEXT NOT NULL,
  reason      TEXT
);

-- ───────────────────────── Bookings ─────────────────────────
ALTER TABLE bookings ADD COLUMN customer_id TEXT REFERENCES customers(id);
ALTER TABLE bookings ADD COLUMN stripe_customer_id TEXT;       -- card saved for tips (off-session)
ALTER TABLE bookings ADD COLUMN payment_method_id TEXT;
ALTER TABLE bookings ADD COLUMN arrived_at TEXT;               -- driver at pickup
ALTER TABLE bookings ADD COLUMN picked_up_at TEXT;             -- loaded, heading to drop-off
ALTER TABLE bookings ADD COLUMN tip_token_hash TEXT;           -- link in the completion text
ALTER TABLE bookings ADD COLUMN tip_cents INTEGER NOT NULL DEFAULT 0;
CREATE INDEX bookings_customer ON bookings (customer_id, created_at);
CREATE INDEX bookings_driver ON bookings (driver_id, completed_at);
CREATE UNIQUE INDEX bookings_tip_token ON bookings (tip_token_hash);

-- Tips: 100% to the driver. A tip made during the job is charged right away and paid out at completion;
-- it's refunded if the trip is canceled.
CREATE TABLE tips (
  id                 TEXT PRIMARY KEY,
  booking_id         TEXT NOT NULL REFERENCES bookings(id),
  amount_cents       INTEGER NOT NULL,
  percent            INTEGER,                    -- 15 | 18 | 20 when a suggestion was used; NULL for custom
  payment_intent_id  TEXT,
  charge_id          TEXT,
  status             TEXT NOT NULL,              -- requires_action | paid | failed | refunded
  transfer_status    TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  transfer_id        TEXT,
  transfer_attempts  INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL
);
CREATE INDEX tips_booking ON tips (booking_id);
CREATE INDEX tips_transfer ON tips (transfer_status);
