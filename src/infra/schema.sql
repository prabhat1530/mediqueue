-- MediQueue schema. Every statement uses IF NOT EXISTS, so running it again is safe.

CREATE TABLE IF NOT EXISTS doctors (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  specialization   TEXT NOT NULL,
  avg_consult_mins INTEGER NOT NULL DEFAULT 10   -- used for wait-time estimates
);

CREATE TABLE IF NOT EXISTS patients (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL,
  phone  TEXT NOT NULL,
  age    INTEGER NOT NULL
);

-- One bookable time window for one doctor, e.g. Dr. A, 10:00-10:15.
CREATE TABLE IF NOT EXISTS slots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id),
  start_time TEXT NOT NULL,                 -- local time: 2026-10-22T10:00
  UNIQUE (doctor_id, start_time)
);

-- UNIQUE(slot_id) prevents double-booking: if two receptionists book the
-- same slot at the same moment, the database rejects the second insert.
CREATE TABLE IF NOT EXISTS appointments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id    INTEGER NOT NULL UNIQUE REFERENCES slots(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  created_at TEXT NOT NULL
);

-- A patient's place in a doctor's live queue for one day.
CREATE TABLE IF NOT EXISTS tokens (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id      INTEGER NOT NULL REFERENCES doctors(id),
  patient_id     INTEGER NOT NULL REFERENCES patients(id),
  appointment_id INTEGER UNIQUE REFERENCES appointments(id),  -- one check-in per appointment
  token_no       INTEGER NOT NULL,
  category       TEXT NOT NULL,                -- EMERGENCY | SENIOR | APPOINTMENT | WALKIN | ...
  status         TEXT NOT NULL DEFAULT 'WAITING'
                 CHECK (status IN ('WAITING','CALLED','IN_CONSULTATION','DONE','NO_SHOW')),
  queue_date     TEXT NOT NULL,                -- YYYY-MM-DD
  created_at     TEXT NOT NULL,                -- ISO timestamp, used for aging
  updated_at     TEXT,
  UNIQUE (doctor_id, queue_date, token_no)
);

-- Speeds up "give me today's active queue for doctor X".
CREATE INDEX IF NOT EXISTS idx_tokens_queue ON tokens (doctor_id, queue_date, status);

CREATE TABLE IF NOT EXISTS consultations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id     INTEGER NOT NULL UNIQUE REFERENCES tokens(id),
  notes        TEXT,
  prescription TEXT,
  created_at   TEXT NOT NULL
);

-- Log of sent notifications. The UNIQUE key stops the same alert going out twice.
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id   INTEGER NOT NULL REFERENCES tokens(id),
  type       TEXT NOT NULL,                    -- TURN_NEAR | CALLED
  channel    TEXT NOT NULL,                    -- CONSOLE | SMS | ...
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (token_id, type, channel)
);
