-- The team's triage of reports in the dashboard's inbox. Reports themselves live in PostHog and
-- are never stored here; a row holds only where the team stands with one, by its report ID.
CREATE TABLE report_triage (
  report_id TEXT PRIMARY KEY,
  -- 'open', 'replied', or 'closed'.
  status TEXT NOT NULL,
  -- An internal note for the team; the sender never sees it.
  note TEXT,
  -- The Access email of who last changed it, and when, as a UTC ISO timestamp.
  handled_by TEXT NOT NULL,
  handled_at TEXT NOT NULL
) WITHOUT ROWID;
