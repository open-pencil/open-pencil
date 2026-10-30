-- Daily pings by the network they came from: the autonomous system Cloudflare reports for the
-- request, never the address. Kept apart from usage_pings so the build counters stay as they are.
CREATE TABLE ping_networks (
  day TEXT NOT NULL,
  -- The AS number, or 0 when Cloudflare reported none.
  asn INTEGER NOT NULL,
  app TEXT NOT NULL,
  platform TEXT NOT NULL,
  -- The operator's name as reported; Cloudflare words it differently between requests, so each
  -- wording keeps its own count and the dashboard names the network by the commonest.
  name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, asn, app, platform, name)
) WITHOUT ROWID;
