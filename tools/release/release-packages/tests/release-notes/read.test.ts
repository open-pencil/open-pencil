import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, sep } from 'node:path'

import { readReleaseNotes, releaseChangelogPath } from '#release/release-notes/read'

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

async function changelogPath(contents = changelog) {
  const directory = join(tmpdir(), `open-pencil-release-notes-${crypto.randomUUID()}`)
  await mkdir(directory, { recursive: true })
  const path = join(directory, 'CHANGELOG.md')
  await writeFile(path, contents)
  return path
}

describe('readReleaseNotes', () => {
  test('extracts the requested version without its heading and preserves Markdown', async () => {
    expect(await readReleaseNotes(await changelogPath(), '1.2.0')).toBe(
      `### Added

- Shipped **feature**.

### Fixed

- Corrected behavior.
`
    )
  })

  test('keeps HTML comments and code spans as written', async () => {
    const path = await changelogPath(`# Changelog

## 2.0.0 — 2026-11-22

### Changed

- Paste no longer reads the \`<!--(openpencil)-->\` HTML format.
<!-- A note for maintainers. -->

## 1.9.0 — 2026-11-01

### Fixed

- Older.
`)
    expect(await readReleaseNotes(path, '2.0.0')).toBe(`### Changed

- Paste no longer reads the \`<!--(openpencil)-->\` HTML format.
<!-- A note for maintainers. -->
`)
  })

  test('rejects missing and empty release sections', async () => {
    await expect(readReleaseNotes(await changelogPath(), '9.9.9')).rejects.toThrow(
      'Changelog section not found for 9.9.9'
    )
    await expect(
      readReleaseNotes(await changelogPath('## 1.2.0 — 2026-08-16\n'), '1.2.0')
    ).rejects.toThrow('Changelog section is empty for 1.2.0')
  })

  test('rejects a section too long for a GitHub release', async () => {
    const entries = Array.from({ length: 700 }, (_, n) => `- Change ${n} ${'x'.repeat(180)}.`)
    const path = await changelogPath(
      `## 2.0.0 — 2026-11-22\n\n### Fixed\n\n${entries.join('\n')}\n`
    )
    await expect(readReleaseNotes(path, '2.0.0')).rejects.toThrow(
      /^Changelog section for 2\.0\.0 is \d+ characters; a GitHub release takes 125000$/
    )
  })

  test('reads the changelog of the checkout this tooling is in', async () => {
    const path = await releaseChangelogPath()
    expect(basename(path)).toBe('CHANGELOG.md')
    expect(import.meta.dirname.startsWith(`${dirname(path)}${sep}`)).toBe(true)
  })
})
