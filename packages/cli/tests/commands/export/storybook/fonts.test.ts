import { describe, expect, test } from 'bun:test'

import { documentFolder } from '#cli/commands/export/storybook/fonts'

describe('Storybook document folders', () => {
  test('differ for documents of the same name exported into one folder', () => {
    expect(documentFolder('../kit/design.fig', undefined)).toBe('openpencil/kit-design')
    expect(documentFolder('../app/design.fig', undefined)).toBe('openpencil/app-design')
    // A one-page export keeps its page's fonts apart from the others'.
    expect(documentFolder('design.fig', 'Icons')).toBe('openpencil/design-icons')
    // However far the document is from the output, the name is its folder and file.
    expect(documentFolder('../../../../work/kits/primitives.fig', undefined)).toBe(
      'openpencil/kits-primitives'
    )
    expect(documentFolder('v1.2/design.fig', undefined)).toBe('openpencil/v1-2-design')
  })
})
