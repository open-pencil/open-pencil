import { useEventListener } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { designModelConnection } from '@/app/ai/models'
import { cloudAIIdentity, cloudMonthlyAllowance, cloudOwnsWorkspace } from '@/app/cloud/integration'

import { useCloudCreditBalance } from './balance'
import { OPENPENCIL_AI_PROVIDER } from './provider'

/** Credits are low below this share of the monthly allowance. */
export const LOW_CREDIT_SHARE = 0.1
/** Where a workspace whose allowance is unknown counts as low: a handful of design replies. */
export const LOW_CREDIT_FLOOR = 300

/** Where the credits the chat spends stand: running low, run out, or neither. */
export type CloudCreditStanding = 'low' | 'out' | null

/** Whether `balance` credits are low or out, against the month's `allowance` when known. */
export function creditStanding(
  balance: number | null,
  allowance: number | null
): CloudCreditStanding {
  if (balance === null) return null
  if (balance <= 0) return 'out'
  const threshold = allowance === null ? LOW_CREDIT_FLOOR : allowance * LOW_CREDIT_SHARE
  return balance < threshold ? 'low' : null
}

/**
 * The standing of the credits the Design model spends on Cloud, with when the allowance renews
 * and whether the signed-in account pays for them; nothing while the chat uses another provider.
 * Both are read again when the window regains focus, so credits or a plan bought in the browser
 * show once the person comes back.
 */
export function useCloudCreditStanding() {
  const workspaceId = computed(() => {
    const connection = designModelConnection.value
    return connection?.providerID === OPENPENCIL_AI_PROVIDER
      ? (connection.cloudWorkspaceId ?? null)
      : null
  })
  const { balance, renewsAt, refresh } = useCloudCreditBalance({
    workspaceId: () => workspaceId.value,
    replying: () => false
  })
  const allowance = shallowRef<number | null>(null)
  let allowanceRead = 0
  async function readAllowance(): Promise<void> {
    const read = ++allowanceRead
    const id = workspaceId.value
    const next = id ? await cloudMonthlyAllowance(id) : null
    if (read === allowanceRead) allowance.value = next
  }
  // Another sign-in can change the plan behind the same workspace.
  watch(
    [workspaceId, cloudAIIdentity],
    () => {
      allowance.value = null
      void readAllowance()
    },
    { immediate: true }
  )
  useEventListener(window, 'focus', () => {
    if (!workspaceId.value) return
    void refresh()
    void readAllowance()
  })
  return {
    standing: computed(() => creditStanding(balance.value, allowance.value)),
    renewsAt,
    /** Whether the signed-in account pays for these credits, and so can buy more. */
    pays: computed(() => (workspaceId.value ? cloudOwnsWorkspace(workspaceId.value) : false))
  }
}
