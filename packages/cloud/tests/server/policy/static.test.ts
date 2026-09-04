import { describe, expect, test } from 'bun:test'

import { staticEntitlementValues } from '@open-pencil/cloud/server'

describe('structured static entitlements', () => {
  test('maps product-domain configuration to internal feature keys', () => {
    expect(
      staticEntitlementValues({
        documents: { maximumFileBytes: 100, revisionHistory: true },
        storage: { maximumBytes: 1000 },
        sharing: { capabilityLinks: true, anonymousView: true, anonymousEdit: false },
        collaboration: { enabled: true, maximumParticipants: 5 }
      })
    ).toEqual({
      'cloud.documents.maximum-file-bytes': 100,
      'cloud.documents.revision-history': true,
      'cloud.storage.maximum-bytes': 1000,
      'cloud.sharing.capability-links': true,
      'cloud.sharing.anonymous-view': true,
      'cloud.sharing.anonymous-edit': false,
      'cloud.collaboration.enabled': true,
      'cloud.collaboration.maximum-participants': 5
    })
  })
})
