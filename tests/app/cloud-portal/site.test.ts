import { describe, expect, test } from 'bun:test'

import type { CloudAccountStatus } from '@open-pencil/cloud/contract'

import {
  isSecretCloudLink,
  leaveAfterSignOut,
  openLocalEditor,
  siteDestination,
  type SiteAccount
} from '@/app/cloud-portal/site'

function account(state: CloudAccountStatus['state']): CloudAccountStatus {
  return {
    state,
    user: { userId: 'user-1', email: 'ada@example.com', name: 'Ada', deploymentRole: 'user' }
  }
}

const visit = (
  path: string,
  who: SiteAccount,
  options: { localEditor?: boolean; choseLocalEditor?: boolean; search?: string } = {}
) =>
  siteDestination({
    path,
    search: options.search,
    account: who,
    localEditor: options.localEditor ?? true,
    choseLocalEditor: options.choseLocalEditor ?? false
  })

describe('Cloud server editor pages', () => {
  test('open the editor for an account that may use the server', () => {
    expect(visit('/', account('active'))).toBeNull()
    expect(visit('/', account('active'), { localEditor: false })).toBeNull()
  })

  test('welcome visitors at the root who are not signed in or not let in yet', () => {
    expect(visit('/', null)).toBe('/welcome')
    expect(visit('/', account('pending'))).toBe('/welcome')
    expect(visit('/', account('revoked'))).toBe('/welcome')
  })

  test('open the local editor once this browser chose it, and other pages without asking', () => {
    expect(visit('/', null, { choseLocalEditor: true })).toBeNull()
    expect(visit('/demo', null)).toBeNull()
  })

  test('welcome everyone without an account where the server turns the local editor off', () => {
    expect(visit('/', null, { localEditor: false, choseLocalEditor: true })).toBe('/welcome')
    expect(visit('/demo', null, { localEditor: false })).toBe('/welcome')
    expect(visit('/rooms/room', account('pending'), { localEditor: false })).toBe('/welcome')
  })

  test('send a document link to sign in first, and back to the document afterwards', () => {
    expect(visit('/documents/a', null, { search: '?version=v' })).toBe(
      '/auth/sign-in?redirect=%2Fdocuments%2Fa%3Fversion%3Dv'
    )
    expect(visit('/documents/a', null, { choseLocalEditor: true })).toBe(
      '/auth/sign-in?redirect=%2Fdocuments%2Fa'
    )
    expect(visit('/documents/a', account('pending'))).toBe('/welcome')
    expect(visit('/documents/a', account('active'))).toBeNull()
  })

  test('tell links that carry their secret, which open on their own, from look-alikes', () => {
    const link = (address: string) => isSecretCloudLink(new URL(address, 'https://cloud.example'))
    expect(link('/documents/a')).toBe(false)
    expect(link('/share/b#secret')).toBe(true)
    expect(link('/invitations/c#token')).toBe(true)
    expect(link('/share/b')).toBe(false)
    expect(link('/share/b/c#secret')).toBe(false)
    expect(link('/rooms/b#secret')).toBe(false)
  })

  test('open the editor when the server cannot say, since the editor works without it', () => {
    expect(visit('/', 'unreachable', { localEditor: false })).toBeNull()
  })
})

describe('signing out of the server that serves the editor', () => {
  function leave(serverAllowsLocalEditor: boolean): string[] {
    const assigned: string[] = []
    leaveAfterSignOut(serverAllowsLocalEditor, { assign: (url) => assigned.push(String(url)) })
    return assigned
  }

  // One test, since the browser's choice of the local editor is kept for the module's lifetime.
  test('leaves for the welcome page unless this browser chose the local editor the server allows', () => {
    expect(leave(false)).toEqual(['/welcome'])
    expect(leave(true)).toEqual(['/welcome'])
    openLocalEditor({ assign: () => undefined })
    expect(leave(true)).toEqual([])
    expect(leave(false)).toEqual(['/welcome'])
  })
})
