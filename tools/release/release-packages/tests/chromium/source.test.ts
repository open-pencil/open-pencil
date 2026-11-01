import { expect, test } from 'bun:test'

import { assertChromiumSource } from '#release/chromium/source'

const tagCommit = 'a'.repeat(40)
const source = { configVersion: '0.17.0', tag: 'v0.17.0', tagCommit, masterBase: tagCommit }

test('builds a release from a branch that merged exactly its tag', () => {
  expect(assertChromiumSource(source)).toBe('0.17.0')
  expect(
    assertChromiumSource({ ...source, configVersion: '0.17.0-beta.1', tag: 'v0.17.0-beta.1' })
  ).toBe('0.17.0-beta.1')
})

test('refuses a branch at another version', () => {
  expect(() => assertChromiumSource({ ...source, configVersion: '0.16.0' })).toThrow(
    'merge v0.17.0 into it'
  )
})

test('refuses a branch based on other master commits than the tag', () => {
  expect(() => assertChromiumSource({ ...source, masterBase: 'b'.repeat(40) })).toThrow(
    'merge exactly v0.17.0'
  )
})

test('refuses tags that are not releases', () => {
  expect(() => assertChromiumSource({ ...source, tag: 'chromium' })).toThrow()
})
