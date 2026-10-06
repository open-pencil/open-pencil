import { describe, expect, test } from 'bun:test'

import { tokenValidator } from '#dom-css/tokens/cssom-validator'

describe('token names', () => {
  test.each(['color-primary', 'spacing_4', '2xl', 'text-type-title'])('%s is a name', (name) => {
    expect(tokenValidator.name(name)).toBe(true)
  })

  // The headless parser also keeps `--a;b`; browsers, where names are typed, drop it.
  test.each(['', '--', '-x', 'a b', 'a:b', 'a,b', 'a/b', 'a(b', 'a}b', 'a{b'])(
    '%p is not',
    (name) => {
      expect(tokenValidator.name(name)).toBe(false)
    }
  )
})
