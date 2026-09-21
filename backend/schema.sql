CREATE TABLE IF NOT EXISTS employees (
  user_id text PRIMARY KEY,
  profile jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employees_department ON employees ((profile->>'DEPT_CD')) WHERE active;
CREATE TABLE IF NOT EXISTS directory_state (id integer PRIMARY KEY CHECK (id=1), synced_at timestamptz NOT NULL, employee_count integer NOT NULL);
CREATE TABLE IF NOT EXISTS leader_scopes (
  leader_id text NOT NULL REFERENCES employees(user_id), dept_cd text NOT NULL,
  PRIMARY KEY (leader_id, dept_cd)
);
CREATE TABLE IF NOT EXISTS boosters (
  id uuid PRIMARY KEY, campaign text NOT NULL, sender_id text NOT NULL REFERENCES employees(user_id),
  recipient_id text NOT NULL REFERENCES employees(user_id), project_name text NOT NULL,
  partner text NOT NULL, missions jsonb NOT NULL, boosts jsonb NOT NULL, impacts jsonb NOT NULL,
  message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL, request_hash text NOT NULL,
  CHECK (sender_id <> recipient_id), UNIQUE (sender_id, request_id)
);
CREATE INDEX IF NOT EXISTS boosters_sender_time ON boosters(sender_id, created_at);
CREATE INDEX IF NOT EXISTS boosters_recipient_time ON boosters(recipient_id, created_at);
CREATE TABLE IF NOT EXISTS replies (
  booster_id uuid PRIMARY KEY REFERENCES boosters(id), message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS point_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign text NOT NULL, user_id text NOT NULL REFERENCES employees(user_id),
  booster_id uuid NOT NULL REFERENCES boosters(id), kind text NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind='send' AND points=10) OR (kind='receive' AND points=20) OR (kind='reply' AND points=5)),
  UNIQUE (user_id, booster_id, kind)
);
CREATE INDEX IF NOT EXISTS point_entries_user ON point_entries(user_id,campaign);
