import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'

import { permissionNotifier } from '@/app/ai/agents/acp/permission'
import { AGENT_INPUT_NOTIFY_DELAY_MS } from '@/constants'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('permission notifications', () => {
  test('a question left waiting notifies once, with its title', () => {
    const notified: string[] = []
    const onPermission = permissionNotifier((title) => notified.push(title))
    onPermission({ title: 'Run tests', waiting: true })
    jest.advanceTimersByTime(AGENT_INPUT_NOTIFY_DELAY_MS - 1)
    expect(notified).toEqual([])
    jest.advanceTimersByTime(1)
    expect(notified).toEqual(['Run tests'])
    jest.advanceTimersByTime(AGENT_INPUT_NOTIFY_DELAY_MS)
    expect(notified).toEqual(['Run tests'])
  })

  test('a question answered before the delay notifies nothing', () => {
    const notified: string[] = []
    const onPermission = permissionNotifier((title) => notified.push(title))
    onPermission({ title: 'Run tests', waiting: true })
    onPermission({ title: 'Run tests', waiting: false })
    jest.advanceTimersByTime(AGENT_INPUT_NOTIFY_DELAY_MS)
    expect(notified).toEqual([])
  })

  test('an answered question leaves another one waiting to notify', () => {
    const notified: string[] = []
    const onPermission = permissionNotifier((title) => notified.push(title))
    onPermission({ title: 'Run tests', waiting: true })
    onPermission({ title: 'Edit file', waiting: true })
    onPermission({ title: 'Run tests', waiting: false })
    jest.advanceTimersByTime(AGENT_INPUT_NOTIFY_DELAY_MS)
    expect(notified).toEqual(['Edit file'])
  })

  test('without a way to notify, a waiting question is ignored', () => {
    const onPermission = permissionNotifier(null)
    onPermission({ title: 'Run tests', waiting: true })
    expect(jest.getTimerCount()).toBe(0)
  })
})
