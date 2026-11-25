import { describe, expect, test } from 'bun:test'

import { forceStates } from '#dom-css/import/states'

describe('forced states', () => {
  test('leave everything but state pseudo-classes as written', () => {
    const css = `a[title=":hover"]::before { content: ":hover" } /* :hover */ a:not(.x) { color: red }`
    expect(forceStates(css)).toBe(css)
  })
})
