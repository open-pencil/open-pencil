-- Daily downloads of each package the npm organization publishes, as npm's public download
-- counts report them; days without downloads are recorded as zero.
CREATE TABLE npm_downloads (
  day TEXT NOT NULL,
  package TEXT NOT NULL,
  downloads INTEGER NOT NULL,
  PRIMARY KEY (day, package)
) WITHOUT ROWID;
