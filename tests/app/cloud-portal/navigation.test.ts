import { describe, expect, test } from 'bun:test'

import type { LocationQuery, RouteMeta } from 'vue-router'

import type { CloudAccountStatus } from '@open-pencil/cloud/contract'

import { portalDestination, type PortalRouteTarget } from '@/app/cloud-portal/navigation'

function target(path: string, meta: RouteMeta = {}, redirect?: string): PortalRouteTarget {
  const query: LocationQuery = redirect ? { redirect } : {}
  const fullPath = redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path
  return { meta, path, fullPath, query }
}

function account(
  state: CloudAccountStatus['state'],
  deploymentRole: 'user' | 'admin' = 'user'
): CloudAccountStatus {
  return {
    state,
    user: { userId: 'user-1', email: 'ada@example.com', name: 'Ada', deploymentRole }
  }
}

describe('portal access rules', () => {
  test('signed-out pages send a signed-in person to where they were going', () => {
    const signIn = target('/auth/sign-in', { signedOut: true }, '/admin/people')
    expect(portalDestination(signIn, account('active'))).toBe('/admin/people')
    expect(portalDestination(signIn, null)).toBe(true)
  })

  test('a signed-in person is never sent to another origin', () => {
    const signIn = target('/auth/sign-in', { signedOut: true }, 'https://evil.example/')
    expect(portalDestination(signIn, account('active'))).toBe('/')
  })

  test('the welcome page sends a signed-in person to the editor, or to their standing page', () => {
    const welcome = target('/welcome', { signedOut: true })
    expect(portalDestination(welcome, null)).toBe(true)
    expect(portalDestination(welcome, account('active'))).toBe('/')
    expect(portalDestination(welcome, account('pending'))).toBe('/account/pending')
    expect(portalDestination(welcome, account('rejected'))).toBe('/account/closed')
  })

  test('account pages ask for a session and come back after it', () => {
    expect(portalDestination(target('/auth/device', { account: true }), null)).toEqual({
      name: 'sign-in',
      query: { redirect: '/auth/device' }
    })
  })

  test('an account waiting for review or declined only reaches its standing page', () => {
    const security = target('/account', { account: true })
    expect(portalDestination(security, account('pending'))).toBe('/account/pending')
    expect(portalDestination(security, account('rejected'))).toBe('/account/closed')
    expect(portalDestination(security, account('revoked'))).toBe('/account/closed')
  })

  test('standing pages belong only to the accounts they describe', () => {
    const pending = target('/account/pending', { account: true })
    const closed = target('/account/closed', { account: true })
    expect(portalDestination(pending, account('pending'))).toBe(true)
    expect(portalDestination(closed, account('revoked'))).toBe(true)
    expect(portalDestination(closed, account('pending'))).toBe('/account/pending')
    expect(portalDestination(closed, account('active'))).toBe('/')
    expect(portalDestination(pending, account('active'))).toBe('/')
    expect(portalDestination(closed, null)).toEqual({
      name: 'sign-in',
      query: { redirect: '/account/closed' }
    })
  })

  test('console pages ask for a deployment administrator', () => {
    const adminPage = target('/admin/people', { account: true, admin: true })
    expect(portalDestination(adminPage, account('active'))).toBe('/account')
    expect(portalDestination(adminPage, account('active', 'admin'))).toBe(true)
  })
})
