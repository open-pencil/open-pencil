import { describe, expect, test } from 'bun:test'

import { entitlementWriteRefusal } from '#cloud/runtime/node/entitlements/refusal'

const staticConfig = {
  staticEntitlements: { documents: {}, sharing: {}, storage: {}, collaboration: {}, ai: {} }
}

describe('entitlements command', () => {
  test('refuses to write rows the server does not read when entitlements are static', () => {
    expect(entitlementWriteRefusal(staticConfig, 'set', false)).toContain('static [entitlements]')
    expect(entitlementWriteRefusal(staticConfig, 'clear', false)).toContain('static [entitlements]')
  })

  test('reads, dry runs, and database entitlements stay available', () => {
    expect(entitlementWriteRefusal(staticConfig, 'get', false)).toBeNull()
    expect(entitlementWriteRefusal(staticConfig, 'set', true)).toBeNull()
    expect(entitlementWriteRefusal({ staticEntitlements: undefined }, 'set', false)).toBeNull()
  })
})
