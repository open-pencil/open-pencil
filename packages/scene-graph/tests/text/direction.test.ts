import { expect, test } from 'bun:test'

import { detectTextDirection, resolveTextDirection } from '#scene-graph/text/direction'

// Base directions measured in Figma, which takes the first strongly directional character.
test.each([
  ['١٬٢٣٤٫٥ Invoice', 'LTR'],
  ['۱۲۳ Invoice', 'LTR'],
  ['١٢٣٪', 'LTR'],
  ['\u0600١ Invoice', 'LTR'],
  ['\u0610 Invoice', 'LTR'],
  ['中文 العربية', 'LTR'],
  ['Hello مرحبا', 'LTR'],
  ['١٢٣ فاتورة', 'RTL'],
  ['123 فاتورة', 'RTL'],
  ['؟ Invoice', 'RTL'],
  ['߀ Invoice', 'RTL'],
  ['مرحبا world', 'RTL']
] as const)('auto text direction for %s is %s', (text, expected) => {
  expect(resolveTextDirection('AUTO', text)).toBe(expected)
})

test('reads a right-to-left letter outside the Basic Multilingual Plane', () => {
  expect(detectTextDirection('\u{1E900} Invoice')).toBe('RTL')
})

test('keeps an explicit direction', () => {
  expect(resolveTextDirection('RTL', 'Hello')).toBe('RTL')
  expect(resolveTextDirection('LTR', 'مرحبا')).toBe('LTR')
})
