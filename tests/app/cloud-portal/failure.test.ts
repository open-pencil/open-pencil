import { describe, expect, test } from 'bun:test'

import { effectScope } from 'vue'

import { CloudPortalAPIError } from '@open-pencil/cloud/client'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortalFailureMessages } from '@/app/cloud-portal/failure'

describe('portal failure messages', () => {
  test('a wrong two-step code says so, never that something broke on the server', () => {
    const scope = effectScope()
    scope.run(() => {
      const { api } = usePortalFailureMessages()
      const words = useCloudPortalMessages().value
      expect(api(new CloudPortalAPIError('domain', 'code_invalid'))).toBe(words.failureInvalidCode)
      expect(api(new CloudPortalAPIError('domain', 'code_invalid'))).not.toBe(
        words.failureUnavailable
      )
    })
    scope.stop()
  })
})
