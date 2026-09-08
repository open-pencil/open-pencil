import { createCloudAuthClient, type CloudAuthClient } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

export function createDeviceApprovalService(
  discovery: CloudDiscovery,
  auth: CloudAuthClient = createCloudAuthClient(discovery)
) {
  return {
    async inspect(userCode: string) {
      if (!userCode) throw new Error('Device code is required')
      const result = await auth.device({ query: { user_code: userCode } })
      if (result.error || !result.data) throw new Error('Device authorization is unavailable')
      return result.data.status
    },
    async decide(userCode: string, decision: 'approve' | 'deny') {
      if (!userCode) throw new Error('Device code is required')
      const result = await auth.device[decision]({ userCode })
      if (result.error || !result.data?.success) throw new Error('Device authorization failed')
      return decision === 'approve' ? 'approved' : 'denied'
    }
  }
}
