import { computed, shallowRef, watch, type Ref } from 'vue'

import type { CloudServicesClient } from '@open-pencil/cloud/client'
import type { CreditWallet } from '@open-pencil/cloud/contract'

import { cloudAIClient, cloudAIIdentity } from '@/app/cloud/integration'

/** The Home server's AI service as the balance reads it. */
export interface CloudBalanceSource {
  identity: Readonly<Ref<string | null>>
  client: (workspaceId: string) => Pick<CloudServicesClient, 'wallet'> | null
}

const HOME_CLOUD: CloudBalanceSource = { identity: cloudAIIdentity, client: cloudAIClient }

interface CloudBalanceOptions {
  /** The workspace whose credits are shown, or `null` when the chat does not use Cloud. */
  workspaceId: () => string | null
  /** Whether a reply is running; the balance is read again once it ends. */
  replying: () => boolean
}

/**
 * The wallets read so far, by account and workspace, so every view of one workspace's credits
 * shows the same answer: a reply that ends in the chat refreshes the banner's too.
 */
const wallets = shallowRef<ReadonlyMap<string, CreditWallet | null>>(new Map())

function walletKey(identity: string | null, workspaceId: string | null): string | null {
  return identity && workspaceId ? `${identity}\n${workspaceId}` : null
}

/**
 * A workspace's credits on Cloud's AI service. Unknown while it loads, when it cannot be read, and
 * for another account's or workspace's answer, so no view shows a stale balance.
 */
export function useCloudCreditBalance(
  { workspaceId, replying }: CloudBalanceOptions,
  source: CloudBalanceSource = HOME_CLOUD
) {
  let request = 0
  const key = computed(() => walletKey(source.identity.value, workspaceId()))
  const wallet = computed(() => (key.value ? (wallets.value.get(key.value) ?? null) : null))

  function store(at: string, value: CreditWallet | null): void {
    wallets.value = new Map(wallets.value).set(at, value)
  }

  async function refresh(): Promise<void> {
    const current = ++request
    const at = key.value
    const id = workspaceId()
    const client = id ? source.client(id) : null
    if (!at || !client) return
    try {
      const next = await client.wallet()
      if (current === request) store(at, next)
    } catch {
      if (current === request) store(at, null)
    }
  }

  watch(key, () => void refresh(), { immediate: true })
  watch(replying, (now, before) => {
    if (before && !now) void refresh()
  })

  return {
    /** Credits left, or `null` when unknown or unlimited. */
    balance: computed(() => wallet.value?.balance ?? null),
    /** When the monthly allowance renews, if the workspace has one. */
    renewsAt: computed(
      () => wallet.value?.buckets.find((bucket) => bucket.kind === 'allowance')?.expiresAt ?? null
    ),
    refresh
  }
}
