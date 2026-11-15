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

  test('maps services entitlements, including a zero allowance', () => {
    expect(
      staticEntitlementValues(
        parseStaticEntitlementsTOML({ services: { enabled: true, monthly_credit_allowance: 0 } })
      )
    ).toEqual({ 'cloud.services.enabled': true, 'cloud.services.monthly-credit-allowance': 0 })
    expect(() =>
      parseStaticEntitlementsTOML({ services: { monthly_credit_allowance: -1 } })
    ).toThrow()
  })
})
