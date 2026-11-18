import { computed, shallowRef, watch } from 'vue'

import { designModelConnection } from '@/app/ai/models'
import { cloudMonthlyAllowance } from '@/app/cloud/integration'

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
  const threshold = allowance ? allowance * LOW_CREDIT_SHARE : LOW_CREDIT_FLOOR
  return balance < threshold ? 'low' : null
}

/**
 * The standing of the credits the Design model spends on Cloud, with when the allowance renews;
 * nothing while the chat uses another provider.
 */
export function useCloudCreditStanding() {
  const workspaceId = computed(() => {
    const connection = designModelConnection.value
    return connection?.providerID === OPENPENCIL_AI_PROVIDER
      ? (connection.cloudWorkspaceId ?? null)
      : null
  })
  const { balance, renewsAt } = useCloudCreditBalance({
    workspaceId: () => workspaceId.value,
    replying: () => false
  })
  const allowance = shallowRef<number | null>(null)
  watch(
    workspaceId,
    async (id) => {
      allowance.value = null
      const read = id ? await cloudMonthlyAllowance(id) : null
      if (id === workspaceId.value) allowance.value = read
    },
    { immediate: true }
  )
  return {
    standing: computed(() => creditStanding(balance.value, allowance.value)),
    renewsAt
  }
}
