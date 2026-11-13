import { afterEach, describe, expect, test } from 'bun:test'

import { localeSetting } from '@open-pencil/vue/i18n'

import { cloudLocale, onCloudLocaleChange, tellCloudLocale } from '@/app/cloud/sessions/locale'

let accounts = 0

/** A fresh account on a server, so tests don't share what was told. */
function account(server = 'server') {
  accounts++
  return { server, account: `account-${accounts}` }
}

/**
 * A server's account API that records each language it was told, in the order it applied them,
 * and may refuse. `slow` holds each request until `release`.
 */
function server(options: { refuse?: boolean; slow?: boolean } = {}) {
  const told: string[] = []
  const held: Array<() => void> = []
  return {
    told,
    release: () => held.shift()?.(),
    /** How many requests the server has yet to answer. */
    inFlight: () => held.length,
    /** Waits until a request is held. */
    async waiting() {
      while (held.length === 0) await Promise.resolve()
    },
    portal: {
      async setLocale(locale: string) {
        if (options.slow) {
          await new Promise<void>((resolve) => {
            held.push(resolve)
          })
        }
        told.push(locale)
        if (options.refuse) throw new Error('not found')
        return { ok: true as const }
      }
    }
  }
}

afterEach(() => {
  localeSetting.set(undefined)
})

describe('tellCloudLocale', () => {
  test('tells an account’s server the app’s language once, and again after it changes', async () => {
    const { told, portal } = server()
    const signedIn = account()
    localeSetting.set('de')
    await tellCloudLocale(signedIn, portal)
    await tellCloudLocale(signedIn, portal)
    localeSetting.set('ja')
    await tellCloudLocale(signedIn, portal)
    expect(told).toEqual(['de', 'ja'])
  })

  test('tells another account on the same server apart', async () => {
    const { told, portal } = server()
    localeSetting.set('fr')
    await tellCloudLocale(account('shared'), portal)
    await tellCloudLocale(account('shared'), portal)
    expect(told).toEqual(['fr', 'fr'])
  })

  test('ends with the language picked last when it changes while a report is under way', async () => {
    const { told, portal, release, waiting, inFlight } = server({ slow: true })
    const signedIn = account()
    localeSetting.set('de')
    const first = tellCloudLocale(signedIn, portal)
    await waiting()
    localeSetting.set('fr')
    const second = tellCloudLocale(signedIn, portal)
    await Promise.resolve()
    // French waits for German's answer, so the server can't apply them out of order.
    expect(inFlight()).toBe(1)
    release()
    await first
    await waiting()
    release()
    await second
    expect(told).toEqual(['de', 'fr'])
  })

  test('leaves a server that can’t be told, without asking it again', async () => {
    const { told, portal } = server({ refuse: true })
    const signedIn = account()
    localeSetting.set('pl')
    await tellCloudLocale(signedIn, portal)
    await tellCloudLocale(signedIn, portal)
    expect(told).toEqual(['pl'])
  })
})

test('follows the language the person picks', () => {
  const seen: string[] = []
  const stop = onCloudLocaleChange(() => seen.push(cloudLocale()))
  localeSetting.set('ru')
  localeSetting.set('zh-CN')
  stop()
  expect(seen).toEqual(['ru', 'zh-CN'])
})
