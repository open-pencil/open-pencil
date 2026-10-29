import { afterEach, describe, expect, test } from 'bun:test'

import { effectScope, nextTick, ref, type EffectScope } from 'vue'

import type { AIWallet } from '@open-pencil/cloud/contract'

import {
  useCloudCreditBalance,
  type CloudBalanceSource
} from '@/app/ai/providers/openpencil/balance'
import { createDeferred, type Deferred } from '@/app/runtime/deferred'

function wallet(balance: number | null): AIWallet {
  return {
    balance,
    buckets:
      balance === null
        ? []
        : [{ kind: 'allowance', remaining: balance, expiresAt: '2026-11-01T00:00:00.000Z' }]
  }
}

/** A Home server whose wallets answer when the test says so. */
function homeCloud() {
  const identity = ref<string | null>('home:alice')
  const answers: Deferred<AIWallet>[] = []
  const source: CloudBalanceSource = {
    identity,
    client: () =>
      identity.value
        ? {
            wallet: () => {
              const next = createDeferred<AIWallet>()
              answers.push(next)
              return next.promise
            }
          }
        : null
  }
  return { identity, source, answers }
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
})
