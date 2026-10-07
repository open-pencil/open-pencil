import 'fake-indexeddb/auto'
import { afterEach, expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'
import {
  addAgent,
  follow,
  followWorkingAgents,
  presenceOf,
  setPeers
} from '@/app/presence/registry'
import { appPreferences } from '@/app/settings/preferences/store'

const stores: ReturnType<typeof createEditorStore>[] = []
afterEach(() => {
  for (const store of stores.splice(0)) store.dispose()
  appPreferences.value.chat.followAgents = true
})

function setup() {
  const store = createEditorStore()
  stores.push(store)
  return { store, pageId: store.state.currentPageId }
}

const following = (store: ReturnType<typeof createEditorStore>) => presenceOf(store).following.value

test('with Follow agents on, the view follows an agent from the start of its run', () => {
  const { store, pageId } = setup()
  const agent = addAgent(store, 'mcp')
  expect(following(store)).toBeNull()
  agent.update({ status: 'thinking', pageId })
  expect(following(store)).toEqual({ kind: 'agent', agentId: agent.id })
})

test('an agent the person stopped following is left alone until it rests', () => {
  const { store, pageId } = setup()
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 10, y: 10, pageId } })
  follow(store, null)
  agent.update({ cursor: { x: 40, y: 40, pageId } })
  expect(following(store)).toBeNull()

  agent.update({ status: 'idle', cursor: undefined })
  agent.update({ status: 'thinking' })
  expect(following(store)).toEqual({ kind: 'agent', agentId: agent.id })
})

test('when the followed agent rests, the view moves on to one still at work', () => {
  const { store, pageId } = setup()
  const first = addAgent(store, 'chat')
  const second = addAgent(store, 'mcp')
  first.update({ status: 'editing', cursor: { x: 10, y: 10, pageId } })
  second.update({ status: 'editing', cursor: { x: 90, y: 90, pageId } })
  expect(following(store)).toEqual({ kind: 'agent', agentId: first.id })
  first.update({ status: 'idle', cursor: undefined })
  expect(following(store)).toEqual({ kind: 'agent', agentId: second.id })
})

test('following a person is never taken over by an agent', () => {
  const { store, pageId } = setup()
  setPeers(store, [
    {
      clientId: 7,
      name: 'Ana',
      color: { r: 1, g: 0, b: 0, a: 1 },
      agents: [],
      cursor: { x: 0, y: 0, pageId }
    }
  ])
  follow(store, { kind: 'person', clientId: 7 })
  addAgent(store, 'chat').update({ status: 'editing', cursor: { x: 5, y: 5, pageId } })
  expect(following(store)).toEqual({ kind: 'person', clientId: 7 })
})

test('with Follow agents off, agents are followed only by clicking Follow', () => {
  const { store, pageId } = setup()
  appPreferences.value.chat.followAgents = false
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 10, y: 10, pageId } })
  expect(following(store)).toBeNull()

  appPreferences.value.chat.followAgents = true
  followWorkingAgents(store)
  expect(following(store)).toEqual({ kind: 'agent', agentId: agent.id })
})
