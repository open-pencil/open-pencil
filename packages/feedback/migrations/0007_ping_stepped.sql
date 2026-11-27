-- Count pings that send a step apart from those that don't, so the dashboard can leave out what
-- the steps cannot check. Rows from before this column are marked by version: every release and
-- nightly built after the steps landed sends them, and no earlier one does. The web app named
-- itself 0.17.0-beta.2 for a while after they landed, so a handful of its pings stay unmarked.
CREATE TABLE usage_pings_stepped (
  day TEXT NOT NULL,
  version TEXT NOT NULL,
  platform TEXT NOT NULL,
  arch TEXT NOT NULL,
  app TEXT NOT NULL,
  browser TEXT NOT NULL,
  usage_stats TEXT NOT NULL,
  -- 1 for pings that sent how many days the install has pinged, 0 for the rest.
  stepped INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, version, platform, arch, app, browser, usage_stats, stepped)
) WITHOUT ROWID;

INSERT INTO usage_pings_stepped
SELECT day, version, platform, arch, app, browser, usage_stats,
  CASE
    WHEN version IN (
      '0.17.0-beta.3', '0.17.0-beta.4', '0.17.0-beta.5', '0.17.0-beta.6', '0.17.0-beta.7', '0.17.0'
    ) OR version LIKE '0.17.0-nightly.%' OR version LIKE '0.18.%' THEN 1
    ELSE 0
  END,
  count
FROM usage_pings;

DROP TABLE usage_pings;
ALTER TABLE usage_pings_stepped RENAME TO usage_pings;
