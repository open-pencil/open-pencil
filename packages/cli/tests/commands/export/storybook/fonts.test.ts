import { describe, expect, test } from 'bun:test'

import { fontFolder } from '#cli/commands/export/storybook/fonts'

describe('Storybook font folders', () => {
  test('differ for documents of the same name exported into one folder', () => {
    expect(fontFolder('../kit/design.fig', undefined)).toBe('fonts/kit-design')
    expect(fontFolder('../app/design.fig', undefined)).toBe('fonts/app-design')
    // A one-page export keeps its page's fonts apart from the others'.
    expect(fontFolder('design.fig', 'Icons')).toBe('fonts/design-icons')
  })
})
