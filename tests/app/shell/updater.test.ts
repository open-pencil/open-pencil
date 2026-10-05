import { describe, expect, test } from 'bun:test'

import { truncateReleaseNotes } from '@/app/shell/updater'

describe('truncateReleaseNotes', () => {
  test('keeps short notes and drops blank lines', () => {
    expect(truncateReleaseNotes('### Fixed\n\n- One\n- Two\n')).toBe('### Fixed\n- One\n- Two')
  })

  test('caps long notes and marks the cut', () => {
    const body = Array.from({ length: 30 }, (_, i) => `- Item ${i + 1}`).join('\n')
    const lines = truncateReleaseNotes(body, 12).split('\n')
    expect(lines).toHaveLength(13)
    expect(lines[11]).toBe('- Item 12')
    expect(lines[12]).toBe('…')
  })
})
