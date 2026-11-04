import { describe, expect, test } from 'bun:test'

import { parseStaticEntitlementsTOML, staticEntitlementValues } from '#cloud/server'

describe('structured static entitlements', () => {
  test('maps product-domain configuration to internal feature keys', () => {
    expect(
      staticEntitlementValues({
        documents: { maximumFileBytes: 100, revisionHistory: true },
        storage: { maximumBytes: 1000 },
        sharing: { links: true, guestView: true, guestEdit: false },
        collaboration: { enabled: true, maximumParticipants: 5 }
      })
    ).toEqual({
      'cloud.documents.maximum-file-bytes': 100,
      'cloud.documents.revision-history': true,
      'cloud.storage.maximum-bytes': 1000,
      'cloud.sharing.links': true,
      'cloud.sharing.guest-view': true,
      'cloud.sharing.guest-edit': false,
      'cloud.collaboration.enabled': true,
      'cloud.collaboration.maximum-participants': 5
    })
  })

  test('maps AI service entitlements, including a zero allowance', () => {
    expect(
      staticEntitlementValues(
        parseStaticEntitlementsTOML({ ai: { enabled: true, monthly_credit_allowance: 0 } })
      )
    ).toEqual({ 'cloud.ai.enabled': true, 'cloud.ai.monthly-credit-allowance': 0 })
    expect(() => parseStaticEntitlementsTOML({ ai: { monthly_credit_allowance: -1 } })).toThrow()
  })
})
