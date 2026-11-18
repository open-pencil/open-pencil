import { describe, expect, test } from 'bun:test'

import { effectScope } from 'vue'

import { CloudPortalAPIError } from '@open-pencil/cloud/client'

import { usePortalTerms, type PortalTermsServices } from '@/app/cloud-portal/terms'

const legal = {
  termsURL: 'https://example.com/terms',
  termsVersion: '2026-11-15',
  requireAcceptance: true
}

/** A portal whose accepting and signing out answer as each test says, recording the calls. */
function portal(answers: {
  accept?: () => Promise<unknown>
  signOut?: () => ReturnType<PortalTermsServices['auth']['signOut']>
}) {
  const calls: string[] = []
  const context: PortalTermsServices = {
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
        return (await answers.signOut?.()) ?? { ok: true as const, value: undefined }
      }
    },
    async refreshAccount() {
      calls.push('refresh')
      return null
    }
  }
  return { context, calls }
}

function terms(context: PortalTermsServices, outcomes: string[]) {
  const value = effectScope(true).run(() =>
    usePortalTerms(
      {
        onAccepted: () => outcomes.push('accepted'),
        onSignedOut: () => outcomes.push('signed out')
      },
      context
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
      signOut: async () => ({ ok: false as const, failure: 'unavailable' as const })
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
