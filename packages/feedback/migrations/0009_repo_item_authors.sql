-- Who opened each issue or pull request, for the contributors chart: GitHub's login, or NULL for
-- bots and for items not synced since this column was added.
ALTER TABLE repo_items ADD COLUMN author TEXT;

-- Every item is read again from the start, so the next syncs fill in the authors; the counts
-- stay as they are meanwhile.
UPDATE repo_items SET updated_at = '1970-01-01T00:00:00.000Z';
