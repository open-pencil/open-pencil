import { describe, expect, test } from 'bun:test'

import { createApp, effectScope } from 'vue'

import { CloudPortalAPIError } from '@open-pencil/cloud/client'

import { PORTAL_CONTEXT, type PortalContext } from '@/app/cloud-portal/context'
import { usePortalTerms } from '@/app/cloud-portal/terms'

const legal = {
  termsURL: 'https://example.com/terms',
  termsVersion: '2026-11-15',
  requireAcceptance: true
}

/** A portal whose accepting and signing out answer as each test says, recording the calls. */
function portal(answers: { accept?: () => Promise<unknown>; signOut?: () => Promise<unknown> }) {
  const calls: string[] = []
  const context = {
    discovery: { legal },
    api: {
      async acceptTerms(version: string) {
        calls.push(`accept ${version}`)
        await answers.accept?.()
        return { ok: true as const }
      }
    },
    auth: {
      async signOut() {
        calls.push('sign out')
        return (await answers.signOut?.()) ?? { ok: true, value: undefined }
      }
    },
    async refreshAccount() {
      calls.push('refresh')
      return null
    }
  } as unknown as PortalContext
  return { context, calls }
}

function terms(context: PortalContext, outcomes: string[]) {
  const app = createApp({})
  app.provide(PORTAL_CONTEXT, context)
  const scope = effectScope(true)
  const value = app.runWithContext(() =>
    scope.run(() =>
      usePortalTerms({
        onAccepted: () => outcomes.push('accepted'),
        onSignedOut: () => outcomes.push('signed out')
      })
    )
  )
  if (!value) throw new Error('The terms did not start')
  return value
}

describe('usePortalTerms', () => {
  test('accepts the version the page loaded, then reports it', async () => {
    const { context, calls } = portal({})
    const outcomes: string[] = []
    const page = terms(context, outcomes)
    await page.accept()
    expect(calls).toEqual(['accept 2026-11-15', 'refresh'])
    expect(outcomes).toEqual(['accepted'])
    expect(page.error.value).toBeNull()
  })

  test('shows only the latest attempt’s failure', async () => {
    const { context } = portal({
      accept: () => Promise.reject(new CloudPortalAPIError('domain', 'terms_changed')),
      signOut: async () => ({ ok: false, failure: 'unavailable' })
    })
    const outcomes: string[] = []
    const page = terms(context, outcomes)
    await page.accept()
    const accepting = page.error.value
    expect(accepting).not.toBeNull()
    await page.decline()
    expect(page.error.value).not.toBeNull()
    expect(page.error.value).not.toBe(accepting)
    await page.accept()
    expect(page.error.value).toBe(accepting)
    expect(outcomes).toEqual([])
  })

  test('signs out on decline, then reports it', async () => {
    const { context, calls } = portal({})
    const outcomes: string[] = []
    await terms(context, outcomes).decline()
    expect(calls).toEqual(['sign out', 'refresh'])
    expect(outcomes).toEqual(['signed out'])
  })
})
