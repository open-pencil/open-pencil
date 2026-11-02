-- The repository's issues and pull requests, mirrored by the daily snapshot. Each one's opening,
-- closing, and merge times give the open counts on any past day, so the whole history comes from
-- this table rather than from daily totals. Times are UTC ISO timestamps.
CREATE TABLE repo_items (
  number INTEGER PRIMARY KEY,
  -- 'issue' or 'pull'.
  kind TEXT NOT NULL,
  -- GitHub's author_association as of the last sync: OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR...
  author_association TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  -- Pull requests only; a closed pull request without it was closed unmerged.
  merged_at TEXT,
  -- GitHub's last update, where the next sync resumes.
  updated_at TEXT NOT NULL
) WITHOUT ROWID;
