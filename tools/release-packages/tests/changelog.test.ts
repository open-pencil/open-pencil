import { describe, expect, test } from 'bun:test'

import { validateChangelog } from '../src/changelog'

const validChangelog = `# Changelog

## Unreleased

### Breaking changes

- Replace the old API.

### Added

- Add **rich** release notes.

### Fixed

- Preserve user data.

## 1.2.0 — 2026-08-16

### Added

- Ship the previous feature.

## 0.1.0-alpha — 2026-03-01

### Added

- Publish the alpha.
`

function errors(source: string): string[] {
  return validateChangelog(source).errors
}

describe('validateChangelog', () => {
  test('accepts canonical Unreleased and release sections', () => {
    expect(errors(validChangelog)).toEqual([])
  })

  test('requires exactly one Unreleased section', () => {
    expect(errors(validChangelog.replace('## Unreleased', '## 1.3.0 — 2026-09-01'))).toContain(
      'Expected exactly one "## Unreleased" section; found 0.'
    )
    expect(errors(`${validChangelog}\n## Unreleased\n`)).toContain(
      'Expected exactly one "## Unreleased" section; found 2.'
    )
  })

  test('rejects duplicate, unsupported, empty, and out-of-order categories', () => {
    const source = `# Changelog

## Unreleased

### Fixed

- Fix one issue.

### Added

- Add one feature.

### Added

### Internal

- Refactor internals.

## 1.0.0 — 2026-01-01

### Added

- Ship version one.
`
    const result = errors(source)
    expect(result.some((error) => error.includes('category "Added" is out of order'))).toBe(true)
    expect(result.some((error) => error.includes('duplicate Unreleased category "Added"'))).toBe(
      true
    )
    expect(result.some((error) => error.includes('category "Added" is empty'))).toBe(true)
    expect(
      result.some((error) => error.includes('unsupported Unreleased category "Internal"'))
    ).toBe(true)
  })

  test('rejects duplicate Unreleased bullets while preserving Markdown distinctions', () => {
    const source = `# Changelog

## Unreleased

### Added

- Add **one** feature.
- Add **one** feature.
- Add one feature.

## 1.0.0 — 2026-01-01

### Added

- Add **one** feature.
`
    const result = errors(source)
    expect(result.filter((error) => error.includes('duplicate Unreleased bullet'))).toHaveLength(1)
  })

  test('rejects malformed release headings and impossible dates', () => {
    const malformed = validChangelog.replace('## 1.2.0 — 2026-08-16', '## v1.2.0 - August 16, 2026')
    expect(errors(malformed).some((error) => error.includes('invalid release heading'))).toBe(true)

    const impossible = validChangelog.replace('2026-08-16', '2026-02-31')
    expect(errors(impossible).some((error) => error.includes('invalid release date'))).toBe(true)
  })

  test('rejects nested headings and uncategorized content inside Unreleased', () => {
    const nested = validChangelog.replace(
      '- Add **rich** release notes.',
      '#### Details\n\n- Add **rich** release notes.'
    )
    expect(
      errors(nested).some((error) =>
        error.includes('Unreleased content may only use level-three category headings')
      )
    ).toBe(true)

    const uncategorized = validChangelog.replace(
      '## Unreleased\n\n### Breaking changes',
      '## Unreleased\n\n- Uncategorized.\n\n### Breaking changes'
    )
    expect(
      errors(uncategorized).some((error) =>
        error.includes('Unreleased bullets must follow an allowed category heading')
      )
    ).toBe(true)

    const prose = validChangelog.replace(
      '## Unreleased\n\n### Breaking changes',
      '## Unreleased\n\nUnexpected prose.\n\n### Breaking changes'
    )
    expect(errors(prose).some((error) => error.includes('unexpected content in Unreleased'))).toBe(
      true
    )
  })
})
