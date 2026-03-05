import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import {
  AgentSideConnection,
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION
} from '@agentclientprotocol/sdk'

import type * as acp from '@agentclientprotocol/sdk'

import { createAgent, type CreateAgentOptions } from '../../packages/acp/src/agent'
import { SceneGraph, exportFigFile } from '@open-pencil/core'
import { heavy } from '../helpers/test-utils'

interface CollectedUpdates {
  messages: string[]
  toolCalls: acp.ToolCall[]
  toolUpdates: acp.ToolCallUpdate[]
  availableCommands: acp.AvailableCommand[]
}

async function createLinkedPair(options?: CreateAgentOptions) {
  const clientToAgent = new TransformStream<Uint8Array, Uint8Array>()
  const agentToClient = new TransformStream<Uint8Array, Uint8Array>()

  const updates: CollectedUpdates = {
    messages: [],
    toolCalls: [],
    toolUpdates: [],
    availableCommands: []
  }

  const client: acp.Client = {
    async requestPermission(params) {
      return {
        outcome: {
          outcome: 'selected',
          optionId: params.options[0].optionId
        }
      }
    },
    async sessionUpdate(params) {
      const u = params.update
      switch (u.sessionUpdate) {
        case 'agent_message_chunk':
          if (u.content.type === 'text') updates.messages.push(u.content.text)
          break
        case 'tool_call':
          updates.toolCalls.push(u as acp.ToolCall)
          break
        case 'tool_call_update':
          updates.toolUpdates.push(u as acp.ToolCallUpdate)
          break
        case 'available_commands_update':
          updates.availableCommands = u.availableCommands
          break
      }
    }
  }

  const agentConn = new ClientSideConnection(
    () => client,
    ndJsonStream(clientToAgent.writable, agentToClient.readable)
  )

  new AgentSideConnection(
    (conn) => createAgent(conn, '0.0.0-test', options),
    ndJsonStream(agentToClient.writable, clientToAgent.readable)
  )

  const initResult = await agentConn.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true }
    }
  })

  const sessionResult = await agentConn.newSession({
    cwd: process.cwd(),
    mcpServers: []
  })

  return {
    connection: agentConn,
    sessionId: sessionResult.sessionId,
    initResult,
    sessionResult,
    updates,
    close: async () => {
      await clientToAgent.writable.close()
      await agentToClient.writable.close()
    }
  }
}

async function prompt(
  pair: Awaited<ReturnType<typeof createLinkedPair>>,
  text: string
): Promise<acp.PromptResponse> {
  pair.updates.messages = []
  pair.updates.toolCalls = []
  pair.updates.toolUpdates = []
  return pair.connection.prompt({
    sessionId: pair.sessionId,
    prompt: [{ type: 'text', text }]
  })
}

describe('ACP agent', () => {
  let pair: Awaited<ReturnType<typeof createLinkedPair>>

  beforeEach(async () => {
    pair = await createLinkedPair()
  })

  afterEach(async () => {
    await pair.close()
  })

  test('initialize returns correct protocol version and agent info', () => {
    expect(pair.initResult.protocolVersion).toBe(PROTOCOL_VERSION)
    expect(pair.initResult.agentInfo?.name).toBe('open-pencil')
    expect(pair.initResult.agentInfo?.title).toBe('OpenPencil')
    expect(pair.initResult.agentCapabilities?.promptCapabilities?.embeddedContext).toBe(true)
  })

  test('new session returns a valid session ID and sends available commands', () => {
    expect(pair.sessionId).toBeTruthy()
    expect(pair.sessionId.length).toBe(32)
    const commands = pair.updates.availableCommands
    const names = commands.map((c) => c.name)
    expect(names).toContain('new_document')
    expect(names).toContain('open_file')
    expect(names).toContain('save_file')
    expect(names).toContain('create_shape')
    expect(names).toContain('set_fill')
    expect(names).toContain('get_page_tree')
    expect(commands.length).toBeGreaterThan(70)
  })

  test('unrecognized input shows help text', async () => {
    const result = await prompt(pair, 'hello world')
    expect(result.stopReason).toBe('end_turn')
    expect(pair.updates.messages.length).toBe(1)
    expect(pair.updates.messages[0]).toContain('OpenPencil ACP Agent')
    expect(pair.updates.messages[0]).toContain('/new_document')
  })

  test('unknown tool name returns error message', async () => {
    const result = await prompt(pair, '/nonexistent_tool')
    expect(result.stopReason).toBe('end_turn')
    expect(pair.updates.messages[0]).toContain('Unknown tool')
    expect(pair.updates.messages[0]).toContain('nonexistent_tool')
  })

  test('new_document via slash command', async () => {
    const result = await prompt(pair, '/new_document')
    expect(result.stopReason).toBe('end_turn')
    expect(pair.updates.toolCalls.length).toBe(1)
    expect(pair.updates.toolCalls[0].title).toBe('new_document')
    expect(pair.updates.toolCalls[0].status).toBe('pending')

    const completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    expect(completed).toBeDefined()
    const text = (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    const data = JSON.parse(text)
    expect(data.page).toBe('Page 1')
    expect(data.id).toBeTruthy()
  })

  test('new_document via JSON format', async () => {
    const result = await prompt(pair, JSON.stringify({ tool: 'new_document', args: {} }))
    expect(result.stopReason).toBe('end_turn')
    const completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    expect(completed).toBeDefined()
  })

  test('tool without loaded document reports failure', async () => {
    const result = await prompt(pair, '/get_page_tree')
    expect(result.stopReason).toBe('end_turn')
    const failed = pair.updates.toolUpdates.find((u) => u.status === 'failed')
    expect(failed).toBeDefined()
    const text = (failed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    expect(text).toContain('No document loaded')
  })

  test('create_shape after new_document', async () => {
    await prompt(pair, '/new_document')
    const result = await prompt(
      pair,
      '/create_shape {"type": "FRAME", "x": 0, "y": 0, "width": 200, "height": 100, "name": "Test"}'
    )
    expect(result.stopReason).toBe('end_turn')
    const completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    expect(completed).toBeDefined()
    const text = (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    const data = JSON.parse(text)
    expect(data.name).toBe('Test')
    expect(data.type).toBe('FRAME')
    expect(data.id).toBeTruthy()
  })

  test('set_fill validates and applies color', async () => {
    await prompt(pair, '/new_document')
    await prompt(
      pair,
      '/create_shape {"type": "RECTANGLE", "x": 0, "y": 0, "width": 50, "height": 50}'
    )
    const created = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    const createdData = JSON.parse(
      (created!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    )

    await prompt(pair, `/set_fill {"id": "${createdData.id}", "color": "#00ff00"}`)

    await prompt(pair, `/get_node {"id": "${createdData.id}"}`)
    const completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    const nodeData = JSON.parse(
      (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    )
    expect(nodeData.fills[0].color.g).toBeCloseTo(1)
  })

  test('delete_node removes created node', async () => {
    await prompt(pair, '/new_document')
    await prompt(
      pair,
      '/create_shape {"type": "RECTANGLE", "x": 0, "y": 0, "width": 50, "height": 50}'
    )
    const created = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    const { id } = JSON.parse(
      (created!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    )

    await prompt(pair, `/delete_node {"id": "${id}"}`)
    await prompt(pair, `/get_node {"id": "${id}"}`)
    const completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    expect(completed).toBeDefined()
    const text = (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    const data = JSON.parse(text)
    expect(data.error).toContain('not found')
  })

  test('open_file loads a .fig file', async () => {
    const fixturePath = join(import.meta.dir, '..', 'fixtures', 'gold-preview.fig')
    const result = await prompt(pair, `/open_file {"path": "${fixturePath}"}`)
    expect(result.stopReason).toBe('end_turn')
    const completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    const data = JSON.parse(
      (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    )
    expect(data.pages.length).toBeGreaterThan(0)
    expect(data.currentPage).toBeTruthy()
  })

  test('open_file with invalid path reports failure', async () => {
    await prompt(pair, '/open_file {"path": "/nonexistent/file.fig"}')
    const failed = pair.updates.toolUpdates.find((u) => u.status === 'failed')
    expect(failed).toBeDefined()
  })

  test('save_file roundtrips a document', async () => {
    const tmpPath = join(import.meta.dir, '..', `_acp_test_${Date.now()}.fig`)
    try {
      await prompt(pair, '/new_document')
      await prompt(
        pair,
        '/create_shape {"type": "FRAME", "x": 0, "y": 0, "width": 300, "height": 200, "name": "Saved"}'
      )
      await prompt(pair, `/save_file {"path": "${tmpPath}"}`)

      const saveCompleted = pair.updates.toolUpdates.find((u) => u.status === 'completed')
      const saved = JSON.parse(
        (saveCompleted!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
      )
      expect(saved.bytes).toBeGreaterThan(0)

      await prompt(pair, `/open_file {"path": "${tmpPath}"}`)
      await prompt(pair, '/get_page_tree')
      const treeCompleted = pair.updates.toolUpdates.find((u) => u.status === 'completed')
      const tree = JSON.parse(
        (treeCompleted!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
      )
      expect(tree.children.some((c: { name: string }) => c.name === 'Saved')).toBe(true)
    } finally {
      await unlink(tmpPath).catch(() => {})
    }
  })

  test('save_file without document reports failure', async () => {
    await prompt(pair, '/save_file {"path": "/tmp/_acp_no_doc.fig"}')
    const failed = pair.updates.toolUpdates.find((u) => u.status === 'failed')
    expect(failed).toBeDefined()
  })

  test('tool call lifecycle: pending → in_progress → completed', async () => {
    await prompt(pair, '/new_document')
    expect(pair.updates.toolCalls[0].status).toBe('pending')
    const statuses = pair.updates.toolUpdates.map((u) => u.status)
    expect(statuses).toContain('in_progress')
    expect(statuses).toContain('completed')
    const inProgressIdx = statuses.indexOf('in_progress')
    const completedIdx = statuses.indexOf('completed')
    expect(inProgressIdx).toBeLessThan(completedIdx)
  })

  test('tool call lifecycle: pending → in_progress → failed', async () => {
    await prompt(pair, '/get_page_tree')
    expect(pair.updates.toolCalls[0].status).toBe('pending')
    const statuses = pair.updates.toolUpdates.map((u) => u.status)
    expect(statuses).toContain('in_progress')
    expect(statuses).toContain('failed')
  })

  test('tool calls have correct kinds', async () => {
    await prompt(pair, '/new_document')
    await prompt(pair, '/get_page_tree')
    expect(pair.updates.toolCalls[0].kind).toBe('read')

    await prompt(
      pair,
      '/create_shape {"type": "RECTANGLE", "x": 0, "y": 0, "width": 50, "height": 50}'
    )
    expect(pair.updates.toolCalls[0].kind).toBe('edit')
  })

  test('tool calls include rawInput', async () => {
    await prompt(pair, '/new_document')
    await prompt(
      pair,
      '/create_shape {"type": "FRAME", "x": 10, "y": 20, "width": 100, "height": 50}'
    )
    const call = pair.updates.toolCalls[0]
    expect(call.rawInput).toEqual({
      type: 'FRAME',
      x: 10,
      y: 20,
      width: 100,
      height: 50
    })
  })

  test('find_nodes filters by type', async () => {
    await prompt(pair, '/new_document')
    await prompt(
      pair,
      '/create_shape {"type": "FRAME", "x": 0, "y": 0, "width": 100, "height": 100, "name": "F1"}'
    )
    await prompt(
      pair,
      '/create_shape {"type": "RECTANGLE", "x": 0, "y": 0, "width": 50, "height": 50, "name": "R1"}'
    )
    await prompt(
      pair,
      '/create_shape {"type": "FRAME", "x": 0, "y": 0, "width": 100, "height": 100, "name": "F2"}'
    )
    await prompt(pair, '/find_nodes {"type": "FRAME"}')
    const completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    const data = JSON.parse(
      (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    )
    expect(data.count).toBe(2)
  })

  test('full workflow: new → create → query → delete', async () => {
    await prompt(pair, '/new_document')

    await prompt(
      pair,
      '/create_shape {"type": "FRAME", "x": 10, "y": 20, "width": 400, "height": 300, "name": "Container"}'
    )
    let completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    const frame = JSON.parse(
      (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    )

    await prompt(
      pair,
      `/create_shape {"type": "TEXT", "x": 0, "y": 0, "width": 200, "height": 30, "name": "Label", "parent_id": "${frame.id}"}`
    )
    completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    const child = JSON.parse(
      (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    )

    await prompt(pair, `/set_fill {"id": "${frame.id}", "color": "#336699"}`)

    await prompt(pair, '/get_page_tree')
    completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    const tree = JSON.parse(
      (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    )
    const container = tree.children.find((c: { name: string }) => c.name === 'Container')
    expect(container).toBeDefined()
    expect(container.children?.some((c: { name: string }) => c.name === 'Label')).toBe(true)

    await prompt(pair, `/delete_node {"id": "${child.id}"}`)

    await prompt(pair, '/get_page_tree')
    completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
    const tree2 = JSON.parse(
      (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
    )
    const container2 = tree2.children.find((c: { id: string }) => c.id === frame.id)
    expect(container2.children ?? []).toHaveLength(0)
  })
})

describe('ACP agent options', () => {
  test('enableEval=false removes eval from available commands', async () => {
    const pair = await createLinkedPair({ enableEval: false })
    try {
      const names = pair.updates.availableCommands.map((c) => c.name)
      expect(names).not.toContain('eval')
      expect(names).toContain('create_shape')
    } finally {
      await pair.close()
    }
  })

  test('fileRoot restricts open_file and save_file paths', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'openpencil-acp-root-'))
    const insidePath = join(rootDir, 'inside.fig')
    const outsidePath = join(tmpdir(), `outside-${Date.now()}.fig`)

    const graph = new SceneGraph()
    const bytes = await exportFigFile(graph)
    await writeFile(insidePath, new Uint8Array(bytes))

    const pair = await createLinkedPair({ fileRoot: rootDir })
    try {
      await prompt(pair, `/open_file {"path": "${insidePath}"}`)
      const openCompleted = pair.updates.toolUpdates.find((u) => u.status === 'completed')
      expect(openCompleted).toBeDefined()

      await prompt(pair, `/save_file {"path": "${outsidePath}"}`)
      const saveFailed = pair.updates.toolUpdates.find((u) => u.status === 'failed')
      expect(saveFailed).toBeDefined()
      const errText = (saveFailed!.content![0] as { type: 'content'; content: acp.TextContent }).content
        .text
      expect(errText).toContain('outside allowed root')

      await prompt(pair, `/save_file {"path": "${insidePath}"}`)
      const saveCompleted = pair.updates.toolUpdates.find((u) => u.status === 'completed')
      expect(saveCompleted).toBeDefined()
    } finally {
      await pair.close()
      await unlink(outsidePath).catch(() => {})
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('sessions are independent', async () => {
    const pair = await createLinkedPair()
    try {
      const session2 = await pair.connection.newSession({
        cwd: process.cwd(),
        mcpServers: []
      })

      await prompt(pair, '/new_document')

      pair.updates.messages = []
      pair.updates.toolCalls = []
      pair.updates.toolUpdates = []

      const result = await pair.connection.prompt({
        sessionId: session2.sessionId,
        prompt: [{ type: 'text', text: '/get_page_tree' }]
      })

      expect(result.stopReason).toBe('end_turn')
      const failed = pair.updates.toolUpdates.find((u) => u.status === 'failed')
      expect(failed).toBeDefined()
    } finally {
      await pair.close()
    }
  })
})

heavy('ACP agent with large fixtures', () => {
  test('open_file loads nuxtui.fig', async () => {
    const pair = await createLinkedPair()
    try {
      const fixturePath = join(import.meta.dir, '..', 'fixtures', 'nuxtui.fig')
      const result = await prompt(pair, `/open_file {"path": "${fixturePath}"}`)
      expect(result.stopReason).toBe('end_turn')
      const completed = pair.updates.toolUpdates.find((u) => u.status === 'completed')
      const data = JSON.parse(
        (completed!.content![0] as { type: 'content'; content: acp.TextContent }).content.text
      )
      expect(data.pages.length).toBeGreaterThan(0)
      expect(data.currentPage).toBeTruthy()
    } finally {
      await pair.close()
    }
  })
})
