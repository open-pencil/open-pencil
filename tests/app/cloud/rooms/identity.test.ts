import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import { accountRoomIdentity } from '@/app/cloud/rooms/identity'

describe('a member’s identity in rooms', () => {
  test('is their account’s name, on the same color in every tab', () => {
    const account = { id: '5f0c8a6e-6b0e-4a43-9a5e-2f7c1d3b9e10', name: 'Alice' }
    const first = accountRoomIdentity(account)
    const second = accountRoomIdentity(account)
    expect(first.name.value).toBe('Alice')
    expect(second.color).toEqual(first.color)
  })

  test('follows a rename of the account', () => {
    const account = ref({ id: 'alice', name: 'Alice' })
    const identity = accountRoomIdentity(account)
    account.value = { id: 'alice', name: 'Alice Liddell' }
    expect(identity.name.value).toBe('Alice Liddell')
  })

  test('cuts a long name as the relay does, so this tab shows what everyone else sees', () => {
    const identity = accountRoomIdentity({ id: 'bart', name: `  ${'Bartholomew '.repeat(5)}` })
    expect(identity.name.value).toBe('Bartholomew Bartholomew Bartholomew Bart')
  })

  test('picks its color from the account, so people tell each other apart', () => {
    const alice = accountRoomIdentity({ id: 'alice', name: 'Alice' })
    const carol = accountRoomIdentity({ id: 'carol', name: 'Carol' })
    expect(alice.color).not.toEqual(carol.color)
  })
})
