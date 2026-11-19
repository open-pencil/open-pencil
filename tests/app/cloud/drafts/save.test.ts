import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { pendingDraftAction, type PendingDraft } from '@/app/cloud/drafts/save'

const LEFT_AT = Date.UTC(2026, 10, 7, 12)
const HOUR = 60 * 60 * 1000
const draft: PendingDraft = { serverId: 'cloud', recoveryId: 'copy', leftAt: LEFT_AT }

describe('a draft that left to sign up', () => {
  test('saves once its person is signed in, in whichever tab comes back', () => {
    for (const returnedFrom of ['cloud', null]) {
      expect(pendingDraftAction(draft, { now: LEFT_AT + HOUR, signedIn: true, returnedFrom })).toBe(
        'save'
      )
    }
  })

  test('opens unsaved in the tab that came back without signing in', () => {
    expect(
      pendingDraftAction(draft, { now: LEFT_AT + HOUR, signedIn: false, returnedFrom: 'cloud' })
    ).toBe('open')
  })

  test('waits in another tab while its person may still be confirming their address', () => {
    expect(
      pendingDraftAction(draft, { now: LEFT_AT + HOUR, signedIn: false, returnedFrom: null })
    ).toBe('wait')
    expect(
      pendingDraftAction(draft, { now: LEFT_AT + HOUR, signedIn: false, returnedFrom: 'other' })
    ).toBe('wait')
  })

  test('opens unsaved after a day, wherever the app starts', () => {
    expect(
      pendingDraftAction(draft, { now: LEFT_AT + 25 * HOUR, signedIn: false, returnedFrom: null })
    ).toBe('open')
  })
})
