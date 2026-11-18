-- What each monitor check last saw and last told the channel, so an alert posts once when a check
-- changes, not on every run.
CREATE TABLE monitor_state (
  check_name TEXT PRIMARY KEY,
  -- `ok`, `warning`, or `critical`, as the latest run saw it.
  status TEXT NOT NULL,
  -- Runs in a row that saw `status`; an alert waits for the check's confirmation count.
  runs INTEGER NOT NULL,
  -- When the check entered `status`.
  since TEXT NOT NULL,
  -- The status the channel was last told, and when.
  notified_status TEXT NOT NULL,
  notified_at TEXT NOT NULL,
  -- When the problem the channel was told of began; null while it was last told all is well.
  problem_since TEXT,
  -- The latest run of the check, which the outside watchdog reads to know the monitor runs.
  checked_at TEXT NOT NULL
);
