import { expect, test } from 'bun:test'

import { nightlyNotes } from '#release/nightly/notes'

test('names the nightly and the commit it builds, and how to go back', () => {
  const notes = nightlyNotes('0.17.0-nightly.20261116', 'a'.repeat(40), 'open-pencil/open-pencil')
  expect(notes).toContain('0.17.0-nightly.20261116')
  expect(notes).toContain(`https://github.com/open-pencil/open-pencil/commit/${'a'.repeat(40)}`)
  expect(notes).toContain('Settings → Updates → Update channel')
  expect(() => nightlyNotes('0.17.0', 'a'.repeat(40), 'open-pencil/open-pencil')).toThrow()
})
