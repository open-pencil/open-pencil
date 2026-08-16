import { describe, expect, test } from 'bun:test'

import { releaseNotesFromChangelog } from '../src/release-notes'

const changelog = `# Changelog

## Unreleased

### Added

- Pending work.

## 1.2.0 — 2026-08-16

### Added

- Shipped feature.

### Fixed

- Corrected behavior.

## 1.1.0 — 2026-08-01

### Fixed

- Previous fix.
`

describe('releaseNotesFromChangelog', () => {
  test('extracts the requested version without its heading', () => {
    expect(releaseNotesFromChangelog(changelog, '1.2.0')).toBe(
      `### Added

- Shipped feature.

### Fixed

- Corrected behavior.
`
    )
  })

  test('rejects missing and empty release sections', () => {
    expect(() => releaseNotesFromChangelog(changelog, '9.9.9')).toThrow(
      'Changelog section not found for 9.9.9'
    )
    expect(() => releaseNotesFromChangelog('## 1.2.0 — 2026-08-16\n', '1.2.0')).toThrow(
      'Changelog section is empty for 1.2.0'
    )
  })
})
