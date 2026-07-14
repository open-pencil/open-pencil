import { afterEach, describe, expect, test } from 'bun:test'

import { testIdSelector } from '@open-pencil/vue'

const originalCssDescriptor = Reflect.getOwnPropertyDescriptor(globalThis, 'CSS')

function restoreCssGlobal() {
  if (originalCssDescriptor) {
    Object.defineProperty(globalThis, 'CSS', originalCssDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'CSS')
  }
}

afterEach(() => {
  restoreCssGlobal()
})

describe('testIdSelector', () => {
  test('escapes selectors without requiring a browser CSS global', () => {
    Reflect.deleteProperty(globalThis, 'CSS')

    expect(testIdSelector('plain-id')).toBe('[data-test-id="plain-id"]')
    expect(testIdSelector('a"b c')).toBe('[data-test-id="a\\"b\\ c"]')
    expect(testIdSelector('1starts-with-digit')).toBe('[data-test-id="\\31 starts-with-digit"]')
    expect(testIdSelector('-1after-hyphen')).toBe('[data-test-id="-\\31 after-hyphen"]')
    expect(testIdSelector('-')).toBe('[data-test-id="\\-"]')
    expect(testIdSelector('null\u0000char')).toBe('[data-test-id="null�char"]')
  })

  test('uses native CSS.escape when the runtime provides it', () => {
    Object.defineProperty(globalThis, 'CSS', {
      configurable: true,
      value: {
        escape(value: string) {
          return `native-${value}`
        }
      }
    })

    expect(testIdSelector('id')).toBe('[data-test-id="native-id"]')
  })
})
