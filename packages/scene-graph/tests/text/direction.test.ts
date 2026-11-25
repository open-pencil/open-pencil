import { expect, test } from 'bun:test'

import { resolveTextDirection } from '#scene-graph/text/direction'

test.each([
  ['١٬٢٣٤٫٥ Invoice', 'LTR'],
  ['۱۲۳ Invoice', 'LTR'],
  ['١٢٣٪', 'LTR'],
  ['١٢٣ فاتورة', 'RTL'],
  ['߀ Invoice', 'RTL']
] as const)('auto text direction for %s is %s', (text, expected) => {
  expect(resolveTextDirection('AUTO', text)).toBe(expected)
})
