import { parseChangelog } from 'changelog-parser'

export async function readReleaseNotes(path: string, version: string): Promise<string> {
  const changelog = await parseChangelog({ filePath: path, removeMarkdown: false })
  const release = changelog.versions.find((entry) => entry.version === version)
  if (!release) throw new Error(`Changelog section not found for ${version}`)

  const notes = release.body.trim()
  if (!notes) throw new Error(`Changelog section is empty for ${version}`)
  return `${notes}\n`
}
