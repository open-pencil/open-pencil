import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readReleaseNotes, RELEASE_NOTES_LIMIT } from '#release/release-notes'

const changelog = `# Changelog

## Unreleased

### Added

- Pending work.

## 1.2.0 — 2026-08-16

### Added

- Shipped **feature**.

### Fixed

- Corrected behavior.

## 1.1.0 — 2026-08-01

### Fixed

- Previous fix.
`

const REPOSITORY = 'open-pencil/open-pencil'

async function changelogPath(contents = changelog) {
  const directory = join(tmpdir(), `open-pencil-release-notes-${crypto.randomUUID()}`)
  await mkdir(directory, { recursive: true })
  const path = join(directory, 'CHANGELOG.md')
  await writeFile(path, contents)
  return path
}

describe('readReleaseNotes', () => {
  test('extracts the requested version without its heading and preserves Markdown', async () => {
    expect(await readReleaseNotes(await changelogPath(), '1.2.0', REPOSITORY)).toBe(
      `### Added

- Shipped **feature**.

### Fixed

- Corrected behavior.
`
    )
  })

  test('rejects missing and empty release sections', async () => {
    await expect(readReleaseNotes(await changelogPath(), '9.9.9', REPOSITORY)).rejects.toThrow(
      'Changelog section not found for 9.9.9'
    )
    await expect(
      readReleaseNotes(await changelogPath('## 1.2.0 — 2026-08-16\n'), '1.2.0', REPOSITORY)
    ).rejects.toThrow('Changelog section is empty for 1.2.0')
  })

  test('shortens a section past the limit at a whole entry and links the full changelog', async () => {
    const entry = (n: number) => `- Change ${n} ${'x'.repeat(200)}.`
    const added = Array.from({ length: 400 }, (_, n) => entry(n)).join('\n')
    const fixed = Array.from({ length: 400 }, (_, n) => entry(400 + n)).join('\n')
    const section = `## 2.0.0 — 2026-11-22\n\nHighlights.\n\n### Added\n\n${added}\n\n### Fixed\n\n${fixed}\n`
    const notes = await readReleaseNotes(await changelogPath(section), '2.0.0', REPOSITORY)

    expect(notes.length).toBeLessThanOrEqual(RELEASE_NOTES_LIMIT)
    expect(notes.startsWith('Highlights.\n\n### Added\n\n- Change 0 ')).toBe(true)
    expect(notes).toEndWith(
      `[CHANGELOG.md](https://github.com/${REPOSITORY}/blob/v2.0.0/CHANGELOG.md).**\n`
    )
    const body = notes.slice(0, notes.lastIndexOf('\n\n**'))
    expect(body.split('\n').at(-1)).toMatch(/^- Change \d+ x{200}\.$/)
  })

  test('drops a heading the cut would leave with nothing under it', async () => {
    const line = `- ${'y'.repeat(RELEASE_NOTES_LIMIT - 400)}.`
    const tail = `- ${'z'.repeat(1000)}.`
    const section = `## 2.0.0 — 2026-11-22\n\n### Added\n\n${line}\n\n### Fixed\n\n${tail}\n`
    const notes = await readReleaseNotes(await changelogPath(section), '2.0.0', REPOSITORY)

    expect(notes).not.toContain('### Fixed')
    expect(notes).toContain(line)
  })
})
