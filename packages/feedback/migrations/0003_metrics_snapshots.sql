-- Daily snapshots for the metrics dashboard. GitHub only reports running totals and Cloudflare
-- keeps 31 days on the Free plan, so the history exists only if it is recorded each day. `day`
-- is the UTC day a row describes; totals are as of the end of that day.

-- Stars and forks at the end of the day.
CREATE TABLE github_stars (
  day TEXT PRIMARY KEY,
  stars INTEGER NOT NULL,
  forks INTEGER NOT NULL
) WITHOUT ROWID;

-- Running download totals per release and kind of file; the daily change is the difference
-- between two days.
CREATE TABLE release_downloads (
  day TEXT NOT NULL,
  tag TEXT NOT NULL,
  kind TEXT NOT NULL,
  downloads INTEGER NOT NULL,
  PRIMARY KEY (day, tag, kind)
) WITHOUT ROWID;

-- Repository views and clones, which GitHub keeps for 14 days.
CREATE TABLE repo_traffic (
  day TEXT PRIMARY KEY,
  views INTEGER NOT NULL,
  unique_views INTEGER NOT NULL,
  clones INTEGER NOT NULL,
  unique_clones INTEGER NOT NULL
) WITHOUT ROWID;

-- The sites sending visitors to the repository over the 14 days before `day`, as GitHub reports
-- them; it has no per-day breakdown.
CREATE TABLE repo_referrers (
  day TEXT NOT NULL,
  referrer TEXT NOT NULL,
  views INTEGER NOT NULL,
  unique_views INTEGER NOT NULL,
  PRIMARY KEY (day, referrer)
) WITHOUT ROWID;

-- Cloudflare's visits per hostname: page views that arrived from another site or a link.
CREATE TABLE site_visits (
  day TEXT NOT NULL,
  host TEXT NOT NULL,
  visits INTEGER NOT NULL,
  PRIMARY KEY (day, host)
) WITHOUT ROWID;

-- The website's most visited pages each day.
CREATE TABLE site_pages (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  visits INTEGER NOT NULL,
  PRIMARY KEY (day, path)
) WITHOUT ROWID;

-- The website's visits by country each day, as two-letter codes.
CREATE TABLE site_countries (
  day TEXT NOT NULL,
  country TEXT NOT NULL,
  visits INTEGER NOT NULL,
  PRIMARY KEY (day, country)
) WITHOUT ROWID;
