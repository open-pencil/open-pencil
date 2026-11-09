-- One row per day, app, and step of how many days installs have pinged, counting the pings that
-- entered the step apart from the rest; versions that send no step add nothing here.
CREATE TABLE ping_steps (
  day TEXT NOT NULL,
  app TEXT NOT NULL,
  step TEXT NOT NULL,
  entered INTEGER NOT NULL,  -- 1 for pings that moved an install into the step, else 0
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, app, step, entered)
) WITHOUT ROWID;
