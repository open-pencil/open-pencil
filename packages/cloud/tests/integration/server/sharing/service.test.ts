import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-tests/helpers/sharing'
import { DocumentForbiddenError } from '#cloud/server'

describe('document sharing facade integration', () => {
  test('prevents viewers from managing sharing', async () => {
    const context = await seedSharing()
    try {
      await expect(
        context.sharing.createShare('viewer', context.documentId, { permission: 'view' })
      ).rejects.toBeInstanceOf(DocumentForbiddenError)
    } finally {
      await context.runtime.close()
    }
  })
})
