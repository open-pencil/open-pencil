-- OpenPencil Cloud's daily usage, as counts Cloud's internal API reports; nothing here names an
-- account. Days before the first snapshot come from Cloud's own records and have no totals.
CREATE TABLE cloud_usage (
  day TEXT PRIMARY KEY,
  sign_ups INTEGER NOT NULL,
  active_accounts INTEGER NOT NULL,
  documents_created INTEGER NOT NULL,
  revisions INTEGER NOT NULL,
  -- Totals at the end of the day, recorded by the snapshot that ran just after it.
  accounts INTEGER,
  documents INTEGER,
  workspaces INTEGER,
  storage_bytes INTEGER
) WITHOUT ROWID;
