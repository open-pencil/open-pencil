import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readReleaseNotes } from '../src/release-notes'

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

  test('rejects missing and empty release sections', async () => {
    await expect(readReleaseNotes(await changelogPath(), '9.9.9')).rejects.toThrow(
      'Changelog section not found for 9.9.9'
    )
    await expect(
      readReleaseNotes(await changelogPath('## 1.2.0 — 2026-08-16\n'), '1.2.0')
    ).rejects.toThrow('Changelog section is empty for 1.2.0')
  })
})
