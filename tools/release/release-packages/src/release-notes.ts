import { parseChangelog } from 'changelog-parser'

/** GitHub refuses a release whose notes are longer, in characters. */
export const RELEASE_NOTES_LIMIT = 125_000

/**
 * The changelog section for `version`, as a GitHub release's notes. A section longer than GitHub
 * accepts, such as a stable release that folds in its betas, ends at the last whole line that
 * fits and links to the full section in `CHANGELOG.md` at the release's tag in `repository`.
 */
export async function readReleaseNotes(
  path: string,
  version: string,
  repository: string
): Promise<string> {
  const changelog = await parseChangelog({ filePath: path, removeMarkdown: false })
  const release = changelog.versions.find((entry) => entry.version === version)
  if (!release) throw new Error(`Changelog section not found for ${version}`)

  const notes = release.body.trim()
  if (!notes) throw new Error(`Changelog section is empty for ${version}`)
  return fitReleaseNotes(notes, version, repository)
}

function fitReleaseNotes(notes: string, version: string, repository: string): string {
  if (notes.length + 1 <= RELEASE_NOTES_LIMIT) return `${notes}\n`
  const more = `\n\n**These notes are shortened to fit GitHub's limit; every change is in [CHANGELOG.md](https://github.com/${repository}/blob/v${version}/CHANGELOG.md).**\n`
  // Cut after a whole line, an entry or a paragraph, never inside one.
  const cut = notes.lastIndexOf('\n', RELEASE_NOTES_LIMIT - more.length)
  // A heading left with nothing under it goes too.
  const kept = notes
    .slice(0, cut)
    .trimEnd()
    .replace(/(?:\n+#+ [^\n]*)+$/, '')
    .trimEnd()
  if (cut <= 0 || !kept) throw new Error(`Changelog section for ${version} has no line that fits`)
  return `${kept}${more}`
}
