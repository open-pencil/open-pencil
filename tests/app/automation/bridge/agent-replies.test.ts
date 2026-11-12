import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { endRun, forgetAgentChat, startAgentRun } from '@/app/ai/reply/run'
import { readToolChange } from '@/app/ai/tools/changes/store'
import { endAgentSession, noteToolCall, restAgents } from '@/app/automation/agents'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'
import { presenceOf } from '@/app/presence/registry'

const { handleTargetCommand } = createAutomationCommandHandlers(makeFigmaFromStore)
const CHAT = '0123456789abcdef0123456789abcdef'
let stores: EditorStore[] = []

beforeEach(() => {
  // The automation FigmaAPI reads the viewport size from the window.
  Object.assign(globalThis, { window: { innerWidth: 1024, innerHeight: 768 } })
})

afterEach(() => {
  for (const store of stores) store.dispose()
  stores = []
  forgetAgentChat(CHAT)
  endAgentSession('session-1')
  restAgents('acp')
  Reflect.deleteProperty(globalThis, 'window')
})

function document(): { store: EditorStore; target: AutomationTarget } {
  const store = createEditorStore(new SceneGraph())
  stores.push(store)
  const pageId = store.state.currentPageId
  return {
    store,
    target: { store, documentId: 'tab-1', documentName: 'Document', pageId, pageName: 'Page 1' }
  }
}

/** A rectangle made through MCP by the given agent session. */
function createRectangle(target: AutomationTarget, agent: Record<string, unknown>) {
  return handleTargetCommand(target, 'tool', {
    name: 'create_shape',
    args: { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 20 },
    agent: { session: 'session-1', ...agent }
  })
}

describe("an ACP chat's edits during its reply", () => {
  test('join the reply under the agent’s call id, labelled as the chat labels its edits', async () => {
    const { store, target } = document()
    const run = startAgentRun(store, CHAT)
    await createRectangle(target, { kind: 'acp', chat: CHAT, call: 'exec-1' })

    expect(run.undoCalls.map(({ tool, toolCallId }) => ({ tool, toolCallId }))).toEqual([
      { tool: 'create_shape', toolCallId: 'exec-1' }
    ])
    expect(run.changedCalls.has('exec-1')).toBe(true)
    expect(store.undo.peekUndo()?.label).toBe('AI: create_shape')
    // The card shows the change before and after, as for the built-in chat's calls.
    expect(readToolChange('exec-1')?.jsx.after).toContain('Rectangle')
  })

  test('include property edits, which push their own undo entry', async () => {
    const { store, target } = document()
    const created = (await createRectangle(target, { kind: 'mcp' })) as {
      result: { id: string }
    }
    const run = startAgentRun(store, CHAT)
    await handleTargetCommand(target, 'tool', {
      name: 'set_fill',
      args: { id: created.result.id, color: '#3b82f6' },
      agent: { session: 'session-1', kind: 'acp', chat: CHAT, call: 'toolu_fill' }
    })

    expect(store.undo.peekUndo()?.label).toBe('AI: set_fill')
    expect(run.undoCalls.map(({ toolCallId }) => toolCallId)).toEqual(['toolu_fill'])
  })

  test('a failed edit leaves the document free for the next one', async () => {
    const { store, target } = document()
    const run = startAgentRun(store, CHAT)
    const failed = handleTargetCommand(target, 'tool', {
      name: 'set_fill',
      args: { id: '0:404', color: '#3b82f6' },
      agent: { session: 'session-1', kind: 'acp', chat: CHAT, call: 'toolu_missing' }
    })
    await expect(failed).rejects.toThrow()
    await createRectangle(target, { kind: 'acp', chat: CHAT, call: 'toolu_next' })
    expect(run.undoCalls.map(({ toolCallId }) => toolCallId)).toEqual(['toolu_next'])
  })

  test('stay ordinary agent edits after the reply ended, from another chat, or elsewhere', async () => {
    const { store, target } = document()
    const other = document()
    const run = startAgentRun(store, CHAT)
    await createRectangle(target, { kind: 'mcp', call: 'other-1' })
    await createRectangle(target, { kind: 'acp', chat: 'fedcba9876543210', call: 'other-2' })
    await createRectangle(other.target, { kind: 'acp', chat: CHAT, call: 'other-3' })
    endRun(store, run)
    await createRectangle(target, { kind: 'acp', chat: CHAT, call: 'other-4' })

    expect(run.undoCalls).toEqual([])
    expect(['other-1', 'other-2', 'other-3', 'other-4'].map(readToolChange)).toEqual([
      null,
      null,
      null,
      null
    ])
    expect(store.undo.peekUndo()?.label).toStartWith('Agent')
  })
})

describe("an ACP chat's subagents calling tools", () => {
  const subagentCall = { kind: 'acp', chat: CHAT, call: 'toolu_inner' }

  /** The created layer's id, from the tool's response. */
  async function made(target: AutomationTarget, agent: Record<string, unknown>) {
    const response = (await createRectangle(target, agent)) as { result: { id: string } }
    return response.result.id
  }

  test('show as an agent of their own, and their edits still join the reply', async () => {
    const { store, target } = document()
    const run = startAgentRun(store, CHAT)
    noteToolCall(CHAT, { id: 'toolu_inner', subagent: 'toolu_task', ended: false })

    const own = await made(target, { kind: 'acp', chat: CHAT, call: 'toolu_own' })
    const sub = await made(target, subagentCall)

    const agents = presenceOf(store).agents.value
    expect(agents).toHaveLength(2)
    expect(agents.find((agent) => agent.selection?.includes(own))).toBeDefined()
    expect(agents.find((agent) => agent.selection?.includes(sub))).toBeDefined()
    expect(run.undoCalls.map(({ toolCallId }) => toolCallId)).toEqual(['toolu_own', 'toolu_inner'])
  })
})
