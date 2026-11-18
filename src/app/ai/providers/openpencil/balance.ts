import { useDebounceFn } from '@vueuse/core'
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
 * How a wallet read ended: its answer is shown, a later read's answer is shown instead, or it
 * could not be made or answered.
 */
export type WalletReadOutcome = 'shown' | 'superseded' | 'failed'

/** A wallet's latest answer, and the read that gave it. */
interface WalletRead {
  wallet: CreditWallet | null
  read: number
}

/**
 * The wallets read so far, by account and workspace, so every view of one workspace's credits
 * shows the same answer: a reply that ends in the chat refreshes the banner's too.
 */
const wallets = shallowRef<ReadonlyMap<string, WalletRead>>(new Map())
/**
 * The latest read of each wallet, shared by every view, so only its answer is kept: an earlier
 * read that answers last, from any view, never replaces a newer balance.
 */
const latestReads = new Map<string, number>()
let reads = 0

function walletKey(identity: string | null, workspaceId: string | null): string | null {
  return identity && workspaceId ? `${identity}\n${workspaceId}` : null
}

/**
 * How many Cloud model requests each wallet has seen finish, so every view of it reads it again
 * afterwards, whatever made the request: the chat, a review, or naming a conversation.
 */
const settledRequests = shallowRef<ReadonlyMap<string, number>>(new Map())
/** A reply's steps finish one after another, so the wallet is read once they pause. */
const SETTLED_READ_DELAY_MS = 500

/** Notes that a request to a workspace's Cloud models has finished, and so may have spent credits. */
export function noteCloudRequestSettled(
  workspaceId: string,
  identity: string | null = cloudAIIdentity.value
): void {
  const at = walletKey(identity, workspaceId)
  if (!at) return
  const count = (settledRequests.value.get(at) ?? 0) + 1
  settledRequests.value = new Map(settledRequests.value).set(at, count)
}

/**
 * A workspace's credits on Cloud's AI service. Unknown while it loads, when it cannot be read, and
 * for another account's or workspace's answer, so no view shows a stale balance.
 */
export function useCloudCreditBalance(
  { workspaceId, replying }: CloudBalanceOptions,
  source: CloudBalanceSource = HOME_CLOUD
) {
  const key = computed(() => walletKey(source.identity.value, workspaceId()))
  // The first read this view may show: one it started on arriving at the workspace, or later.
  // Views already there keep showing their answer meanwhile.
  const since = shallowRef(Number.POSITIVE_INFINITY)
  const wallet = computed(() => {
    const entry = key.value ? wallets.value.get(key.value) : undefined
    return entry && entry.read >= since.value ? entry.wallet : null
  })

  function store(at: string, entry: WalletRead): void {
    wallets.value = new Map(wallets.value).set(at, entry)
  }

  /**
   * Reads the wallet again, and says which read it is and whether its answer was kept, or `null`
   * with nothing to read.
   */
  function startRead(): { at: string; read: number; done: Promise<WalletReadOutcome> } | null {
    const at = key.value
    const id = workspaceId()
    const client = id ? source.client(id) : null
    if (!at || !client) return null
    const read = ++reads
    latestReads.set(at, read)
    const keep = (value: CreditWallet | null): WalletReadOutcome => {
      if (latestReads.get(at) !== read) return 'superseded'
      store(at, { wallet: value, read })
      return 'shown'
    }
    // A failed read keeps the last balance that was confirmed; a view still waiting for its first
    // read of this visit shows nothing either way.
    return { at, read, done: client.wallet().then(keep, () => 'failed' as const) }
  }

  /** Reads the wallet again, and says how the read ended. */
  async function refresh(): Promise<WalletReadOutcome> {
    const started = startRead()
    if (!started) return 'failed'
    // A view that could not read on arriving, with no client yet, shows this read once it can.
    if (since.value === Number.POSITIVE_INFINITY) since.value = started.read
    return started.done
  }

  // Arriving at a workspace always reads it afresh, since a read already under way may predate
  // credits bought meanwhile, and shows nothing older than that read.
  watch(
    key,
    () => {
      const started = startRead()
      since.value = started ? started.read : Number.POSITIVE_INFINITY
    },
    { immediate: true }
  )
  watch(replying, (now, before) => {
    if (before && !now) void refresh()
  })
  const refreshAfterSettling = useDebounceFn(() => void refresh(), SETTLED_READ_DELAY_MS)
  watch(
    () => [key.value, key.value ? (settledRequests.value.get(key.value) ?? 0) : 0] as const,
    ([at, count], [before, countBefore]) => {
      if (at && at === before && count !== countBefore) void refreshAfterSettling()
    }
  )

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
