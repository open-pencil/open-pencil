import { computed, shallowRef, watch, type Ref } from 'vue'

import type { CloudAIClient } from '@open-pencil/cloud/client'
import type { AIWallet } from '@open-pencil/cloud/contract'

import { cloudAIClient, cloudAIIdentity } from '@/app/cloud/integration'

/** The Home server's AI service as the balance reads it. */
export interface CloudBalanceSource {
  identity: Readonly<Ref<string | null>>
  client: (workspaceId: string) => Pick<CloudAIClient, 'wallet'> | null
}

const HOME_CLOUD: CloudBalanceSource = { identity: cloudAIIdentity, client: cloudAIClient }

interface CloudBalanceOptions {
  /** The workspace whose credits are shown, or `null` when the chat does not use Cloud. */
  workspaceId: () => string | null
  /** Whether a reply is running; the balance is read again once it ends. */
  replying: () => boolean
}

/**
 * A workspace's credits on Cloud's AI service. Unknown while it loads, when it cannot be read, and
 * for another account's or workspace's answer, so the chat never shows a stale balance.
 */
export function useCloudCreditBalance(
  { workspaceId, replying }: CloudBalanceOptions,
  source: CloudBalanceSource = HOME_CLOUD
) {
  const wallet = shallowRef<AIWallet | null>(null)
  let request = 0

  async function refresh(): Promise<void> {
    const current = ++request
    const id = workspaceId()
    const client = id ? source.client(id) : null
    if (!client) {
      wallet.value = null
      return
    }
    try {
      const next = await client.wallet()
      if (current === request) wallet.value = next
    } catch {
      if (current === request) wallet.value = null
    }
  }

  watch(
    [source.identity, workspaceId],
    () => {
      wallet.value = null
      void refresh()
    },
    { immediate: true }
  )
  watch(replying, (now, before) => {
    if (before && !now) void refresh()
  })

  return {
    /** Credits left, or `null` when unknown or unlimited. */
    balance: computed(() => wallet.value?.balance ?? null),
    /** When the monthly allowance renews, if the workspace has one. */
    renewsAt: computed(
      () => wallet.value?.buckets.find((bucket) => bucket.kind === 'allowance')?.expiresAt ?? null
    )
  }
}
