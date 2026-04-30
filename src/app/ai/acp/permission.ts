import { computed, shallowRef } from 'vue'

import { ACP_PERMISSION_TIMEOUT_MS } from '@/constants'

import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk'

export interface PendingPermission {
  request: RequestPermissionRequest
  resolve: (response: RequestPermissionResponse) => void
  timer: ReturnType<typeof setTimeout>
}

export const permissionQueue = shallowRef<PendingPermission[]>([])
export const currentPermission = computed(() => permissionQueue.value[0] ?? null)

function findRejectOption(request: RequestPermissionRequest): string {
  const reject = request.options.find((o) => o.kind.startsWith('reject'))
  return reject?.optionId ?? request.options.at(0)?.optionId ?? ''
}

function removeEntry(entry: PendingPermission) {
  clearTimeout(entry.timer)
  permissionQueue.value = permissionQueue.value.filter((e) => e !== entry)
}

export function requestPermissionFromUser(
  params: RequestPermissionRequest
): Promise<RequestPermissionResponse> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      removeEntry(entry)
      resolve({ outcome: { outcome: 'selected', optionId: findRejectOption(params) } })
    }, ACP_PERMISSION_TIMEOUT_MS)

    const entry: PendingPermission = { request: params, resolve, timer }
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
