import { afterEach, describe, expect, test } from 'bun:test'

import { localeSetting } from '@open-pencil/vue/i18n'

import {
  cloudLocale,
  forgetCloudLocale,
  onCloudLocaleChange,
  tellCloudLocale
} from '@/app/cloud/sessions/locale'

/** A server's account API that records each language it was told, and may refuse. */
function server(refuse = false) {
  const told: string[] = []
  return {
    told,
    portal: {
      async setLocale(locale: string) {
        told.push(locale)
        if (refuse) throw new Error('not found')
        return { ok: true as const }
      }
    }
  }
}

afterEach(() => {
  localeSetting.set(undefined)
  forgetCloudLocale('server')
})

describe('tellCloudLocale', () => {
  test('tells a server the app’s language once, and again after it changes', async () => {
    const { told, portal } = server()
    localeSetting.set('de')
    await tellCloudLocale('server', portal)
    await tellCloudLocale('server', portal)
    localeSetting.set('ja')
    await tellCloudLocale('server', portal)
    expect(told).toEqual(['de', 'ja'])
  })

  test('tells the account signed in next, after the server is forgotten', async () => {
    const { told, portal } = server()
    localeSetting.set('fr')
    await tellCloudLocale('server', portal)
    forgetCloudLocale('server')
    await tellCloudLocale('server', portal)
    expect(told).toEqual(['fr', 'fr'])
  })

  test('leaves a server that can’t be told, without asking it again', async () => {
    const { told, portal } = server(true)
    localeSetting.set('pl')
    await tellCloudLocale('server', portal)
    await tellCloudLocale('server', portal)
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
