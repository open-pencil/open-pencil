import { afterEach, describe, expect, test } from 'bun:test'

import { effectScope, nextTick, ref, type EffectScope } from 'vue'

import type { CreditWallet } from '@open-pencil/cloud/contract'

import {
  noteCloudRequestSettled,
  useCloudCreditBalance,
  type CloudBalanceSource
} from '@/app/ai/providers/openpencil/balance'
import { createDeferred, type Deferred } from '@/app/runtime/deferred'

function wallet(balance: number | null): CreditWallet {
  return {
    balance,
    buckets:
      balance === null
        ? []
        : [{ kind: 'allowance', remaining: balance, expiresAt: '2026-11-01T00:00:00.000Z' }]
  }
}

/**
 * A Home server whose wallets answer when the test says so, for an account of its own, since
 * views share what they read.
 */
function homeCloud() {
  const identity = ref<string | null>(`home:${crypto.randomUUID()}`)
  const answers: Deferred<CreditWallet>[] = []
  /** The workspace each read asked for, in order. */
  const asked: string[] = []
  const source: CloudBalanceSource = {
    identity,
    client: (workspaceId) =>
      identity.value
        ? {
            wallet: () => {
              const next = createDeferred<CreditWallet>()
              answers.push(next)
              asked.push(workspaceId)
              return next.promise
            }
          }
        : null
  }
  return { identity, source, answers, asked }
}

const scopes: EffectScope[] = []
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

function show(source: CloudBalanceSource, workspaceId = ref<string | null>('team')) {
  const replying = ref(false)
  const scope = effectScope()
  scopes.push(scope)
  const balance = scope.run(() =>
    useCloudCreditBalance(
      { workspaceId: () => workspaceId.value, replying: () => replying.value },
      source
    )
  )
  if (!balance) throw new Error('balance was not created')
  return { ...balance, replying, workspaceId }
}

async function settle(): Promise<void> {
  await nextTick()
  await Promise.resolve()
}

describe('useCloudCreditBalance', () => {
  test('shows the workspace’s credits and when its allowance renews', async () => {
    const home = homeCloud()
    const credits = show(home.source)
    home.answers[0]?.resolve(wallet(1200))
    await settle()

    expect(credits.balance.value).toBe(1200)
    expect(credits.renewsAt.value).toBe('2026-11-01T00:00:00.000Z')
  })

  test('reads the balance again once a reply ends', async () => {
    const home = homeCloud()
    const credits = show(home.source)
    home.answers[0]?.resolve(wallet(1200))
    await settle()

    credits.replying.value = true
    await settle()
    expect(home.answers).toHaveLength(1)
    credits.replying.value = false
    await settle()
    home.answers[1]?.resolve(wallet(1100))
    await settle()

    expect(credits.balance.value).toBe(1100)
  })

  test('drops an earlier workspace’s balance that answers last', async () => {
    const home = homeCloud()
    const credits = show(home.source)
    credits.workspaceId.value = 'other'
    await settle()
    expect(credits.balance.value).toBeNull()

    home.answers[1]?.resolve(wallet(50))
    await settle()
    home.answers[0]?.resolve(wallet(1200))
    await settle()

    expect(credits.balance.value).toBe(50)
  })

  test('hides the balance after signing out, an unlimited one, and one that cannot be read', async () => {
    const home = homeCloud()
    const credits = show(home.source)
    home.answers[0]?.resolve(wallet(1200))
    await settle()
    home.identity.value = null
    await settle()
    expect(credits.balance.value).toBeNull()

    home.identity.value = 'home:alice'
    await settle()
    home.answers[1]?.resolve(wallet(null))
    await settle()
    expect(credits.balance.value).toBeNull()

    credits.replying.value = true
    await settle()
    credits.replying.value = false
    await settle()
    home.answers[2]?.reject(new Error('offline'))
    await settle()
    expect(credits.balance.value).toBeNull()
  })

  test('reads nothing for a chat that does not use Cloud', async () => {
    const home = homeCloud()
    const credits = show(home.source, ref<string | null>(null))
    await settle()

    expect(home.answers).toHaveLength(0)
    expect(credits.balance.value).toBeNull()
  })

  test('shows every view of a workspace the balance the last read found', async () => {
    const home = homeCloud()
    const chat = show(home.source)
    const banner = show(home.source)
    home.answers[0]?.resolve(wallet(1200))
    home.answers[1]?.resolve(wallet(1200))
    await settle()
    expect(banner.balance.value).toBe(1200)

    // A reply in the chat reads the balance again, and the banner shows what it found.
    chat.replying.value = true
    await settle()
    chat.replying.value = false
    await settle()
    home.answers[2]?.resolve(wallet(900))
    await settle()
    expect(banner.balance.value).toBe(900)
  })

  test('keeps a newer balance when another view’s earlier read answers last', async () => {
    const home = homeCloud()
    const chat = show(home.source)
    const banner = show(home.source)
    home.answers[0]?.resolve(wallet(1200))
    home.answers[1]?.resolve(wallet(1200))
    await settle()

    // The banner reads, then a reply ends in the chat and reads again; the chat answers first.
    void banner.refresh()
    chat.replying.value = true
    await settle()
    chat.replying.value = false
    await settle()
    const [, , older, newer] = home.answers
    newer?.resolve(wallet(0))
    await settle()
    older?.resolve(wallet(500))
    await settle()

    expect(banner.balance.value).toBe(0)
    expect(chat.balance.value).toBe(0)
  })

  test('shows nothing for a workspace it returns to until its wallet answers again', async () => {
    const home = homeCloud()
    const credits = show(home.source)
    home.answers[0]?.resolve(wallet(0))
    await settle()
    credits.workspaceId.value = 'other'
    await settle()
    home.answers[1]?.resolve(wallet(50))
    await settle()

    credits.workspaceId.value = 'team'
    await settle()
    expect(credits.balance.value).toBeNull()
    home.answers[2]?.resolve(wallet(5_000))
    await settle()
    expect(credits.balance.value).toBe(5_000)
    expect(home.asked).toEqual(['team', 'other', 'team'])
  })

  test('reads afresh on returning, even while a read from before is still under way', async () => {
    const home = homeCloud()
    const credits = show(home.source)
    credits.workspaceId.value = 'other'
    await settle()
    credits.workspaceId.value = 'team'
    await settle()

    // The first read of the team, from before credits were bought, answers last.
    home.answers[2]?.resolve(wallet(5_000))
    await settle()
    home.answers[0]?.resolve(wallet(0))
    await settle()
    expect(credits.balance.value).toBe(5_000)
    expect(home.asked).toEqual(['team', 'other', 'team'])
  })

  test('shows a later read for a view that could not read on arriving', async () => {
    const home = homeCloud()
    let ready = false
    const source: CloudBalanceSource = {
      identity: home.identity,
      client: (id) => (ready ? home.source.client(id) : null)
    }
    const credits = show(source)
    await settle()
    expect(home.answers).toHaveLength(0)

    ready = true
    const read = credits.refresh()
    home.answers[0]?.resolve(wallet(800))
    expect(await read).toBe('shown')
    expect(credits.balance.value).toBe(800)
  })

  test('says how a read ended: shown, replaced by a later one, or failed', async () => {
    const home = homeCloud()
    const credits = show(home.source)
    home.answers[0]?.resolve(wallet(800))
    await settle()

    const replaced = credits.refresh()
    const latest = credits.refresh()
    home.answers[2]?.resolve(wallet(700))
    home.answers[1]?.resolve(wallet(800))
    expect(await latest).toBe('shown')
    expect(await replaced).toBe('superseded')

    const failed = credits.refresh()
    home.answers[3]?.reject(new Error('offline'))
    expect(await failed).toBe('failed')
  })

  test('keeps showing a view its balance while another view arrives and reads', async () => {
    const home = homeCloud()
    const banner = show(home.source)
    home.answers[0]?.resolve(wallet(0))
    await settle()

    const chat = show(home.source)
    await settle()
    expect(banner.balance.value).toBe(0)
    expect(chat.balance.value).toBeNull()
    home.answers[1]?.resolve(wallet(0))
    await settle()
    expect(chat.balance.value).toBe(0)
  })

  test('reads the balance again after a Cloud request settles, whatever made it', async () => {
    const home = homeCloud()
    const banner = show(home.source)
    home.answers[0]?.resolve(wallet(1200))
    await settle()

    // Two steps of one reply finish close together, and the wallet is read once after them.
    noteCloudRequestSettled('team', home.identity.value)
    noteCloudRequestSettled('team', home.identity.value)
    await settle()
    await Bun.sleep(600)
    expect(home.answers).toHaveLength(2)
    home.answers[1]?.resolve(wallet(300))
    await settle()
    expect(banner.balance.value).toBe(300)
  })
})
