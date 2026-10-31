import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk'
import { computed, shallowRef } from 'vue'

import { ACP_PERMISSION_TIMEOUT_MS, AGENT_INPUT_NOTIFY_DELAY_MS } from '@/constants'

export interface PendingPermission {
  request: RequestPermissionRequest
  resolve: (response: RequestPermissionResponse) => void
  timer: ReturnType<typeof setTimeout>
  /** Calls `onUnanswered` if the request is still waiting by then. */
  notice: ReturnType<typeof setTimeout> | null
}

export const permissionQueue = shallowRef<PendingPermission[]>([])
export const currentPermission = computed(() => permissionQueue.value[0] ?? null)

function findRejectOption(request: RequestPermissionRequest): string {
  const reject = request.options.find((o) => o.kind.startsWith('reject'))
  return reject?.optionId ?? request.options.at(0)?.optionId ?? ''
}

function removeEntry(entry: PendingPermission) {
  clearTimeout(entry.timer)
  if (entry.notice) clearTimeout(entry.notice)
  permissionQueue.value = permissionQueue.value.filter((e) => e !== entry)
}

/**
 * Queues the request for the permission dialog. One left unanswered for a few seconds calls
 * `onUnanswered`, which notifies the person, as one answered at once needs no notification; it is
 * rejected once it times out.
 */
export function requestPermissionFromUser(
  params: RequestPermissionRequest,
  onUnanswered?: () => void
): Promise<RequestPermissionResponse> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      removeEntry(entry)
      resolve({ outcome: { outcome: 'selected', optionId: findRejectOption(params) } })
    }, ACP_PERMISSION_TIMEOUT_MS)
    const notice = onUnanswered
      ? setTimeout(() => {
          entry.notice = null
          onUnanswered()
        }, AGENT_INPUT_NOTIFY_DELAY_MS)
      : null

    const entry: PendingPermission = { request: params, resolve, timer, notice }
    permissionQueue.value = [...permissionQueue.value, entry]
  })
}

export function respondToPermission(optionId: string) {
  const entry = permissionQueue.value.at(0)
  if (!entry) return
  removeEntry(entry)
  entry.resolve({ outcome: { outcome: 'selected', optionId } })
}

export function rejectCurrentPermission() {
  const entry = permissionQueue.value.at(0)
  if (!entry) return
  removeEntry(entry)
  entry.resolve({
    outcome: { outcome: 'selected', optionId: findRejectOption(entry.request) }
  })
}
