import { describe, expect, test } from 'bun:test'

import type { SessionUpdate } from '@agentclientprotocol/sdk'
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { createUpdateMapper } from '@/app/ai/agents/acp/events'
import { agentTurnUsage, buildCrashChunks, formatConnectionError } from '@/app/ai/transports/acp'
import { classifyToolState } from '@/components/chat/tool/state'

import { expectDefined } from '#tests/helpers/assert'

const TEXT_ID = 'text-1'

/** The message the chat builds from one turn's updates, as the transport streams them. */
async function transcript(updates: SessionUpdate[]): Promise<UIMessage['parts']> {
  const mapper = createUpdateMapper('turn')
  const chunks: UIMessageChunk[] = [{ type: 'start' }, { type: 'start-step' }]
  for (const update of updates) chunks.push(...mapper.map(update))
  chunks.push(...mapper.end(), { type: 'finish-step' }, { type: 'finish', finishReason: 'stop' })
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    }
  })
  let message: UIMessage | undefined
  for await (const next of readUIMessageStream({ stream })) message = next
  return (message?.parts ?? []).filter((part) => part.type !== 'step-start')
}

function text(value: string): SessionUpdate {
  return { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: value } }
}

function thought(value: string): SessionUpdate {
  return { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: value } }
}

function shown(part: UIMessage['parts'][number]) {
  if (!('toolCallId' in part)) return null
  const output = 'output' in part ? part.output : undefined
  return {
    type: part.type,
    input: part.input,
    state: classifyToolState({ toolName: part.type.slice(5), state: part.state, output }),
    output,
    errorText: 'errorText' in part ? part.errorText : undefined
  }
}

/** Codex reports an MCP call titled by server and tool, with them and the arguments as input. */
function codexCall(server: string, tool: string, args: unknown, id = 'call-1'): SessionUpdate {
  return {
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: `mcp.${server}.${tool}`,
    kind: 'execute',
    status: 'in_progress',
    rawInput: { server, tool, arguments: args }
  }
}

function codexDone(result: unknown, error: unknown = null, id = 'call-1'): SessionUpdate {
  return {
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    status: error ? 'failed' : 'completed',
    rawOutput: { result, error }
  }
}

function mcpText(value: unknown, isError?: boolean) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: null,
    ...(isError ? { isError } : {})
  }
}

describe('an ACP turn in the chat', () => {
  test('text forms one part until something else comes between', async () => {
    const parts = await transcript([
      text('I’ll inspect '),
      text('the page.'),
      codexCall('open-pencil', 'get_page_tree', {}),
      codexDone(mcpText({ children: [] })),
      text('Done.')
    ])
    expect(parts.filter((part) => part.type === 'text').map((part) => part.text)).toEqual([
      'I’ll inspect the page.',
      'Done.'
    ])
  })

  test('a run of thoughts shows as one reasoning part', async () => {
    const parts = await transcript([thought('Plan'), thought(' the grid'), text('Building it.')])
    expect(parts.map((part) => part.type)).toEqual(['reasoning', 'text'])
    expect(parts[0]).toMatchObject({ text: 'Plan the grid' })
  })

  test('OpenPencil’s own tools show as the built-in chat’s, with their arguments and result', async () => {
    const [call] = await transcript([
      codexCall('open-pencil', 'render', { jsx: '<Frame name="Calendar" />' }),
      codexDone(mcpText({ id: '1:2', name: 'Calendar' }))
    ])
    expect(shown(expectDefined(call, 'tool part'))).toMatchObject({
      type: 'tool-render',
      input: { jsx: '<Frame name="Calendar" />' },
      state: 'done',
      output: { id: '1:2', name: 'Calendar' }
    })
  })

  test('an exported image is passed on as the built-in chat holds it', async () => {
    const [call] = await transcript([
      codexCall('open-pencil', 'export_image', { ids: ['1:2'] }),
      codexDone({ content: [{ type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' }] })
    ])
    expect(shown(expectDefined(call, 'tool part'))?.output).toEqual({
      base64: 'iVBORw0KGgo=',
      mimeType: 'image/png'
    })
  })

  test('a tool error shows as a failed call with the tool’s message', async () => {
    const parts = await transcript([
      codexCall('open-pencil', 'describe', { id: '9:9' }, 'a'),
      codexDone(mcpText({ error: 'Node 9:9 not found' }, true), null, 'a'),
      codexCall('open-pencil', 'describe', { id: '9:9' }, 'b'),
      codexDone(null, { message: 'tool call timed out' }, 'b')
    ])
    expect(parts.map((part) => shown(part))).toMatchObject([
      { state: 'error', errorText: 'Node 9:9 not found' },
      { state: 'error', errorText: 'tool call timed out' }
    ])
  })

  test('another server’s tools keep the MCP name and result', async () => {
    const result = mcpText({ url: 'https://example.com' })
    const [call] = await transcript([
      codexCall('playwriter', 'execute', { code: 'page.url()' }),
      codexDone(result)
    ])
    expect(shown(expectDefined(call, 'tool part'))).toMatchObject({
      type: 'tool-mcp__playwriter__execute',
      input: { code: 'page.url()' },
      state: 'done',
      output: result
    })
  })

  test('Claude’s calls to OpenPencil’s tools show the same way, input arriving later', async () => {
    const meta = { claudeCode: { toolName: 'mcp__open-pencil__render' } }
    const [call] = await transcript([
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'toolu_1',
        title: 'render',
        kind: 'other',
        status: 'pending',
        rawInput: {},
        _meta: meta
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'toolu_1',
        rawInput: { jsx: '<Frame />' },
        _meta: meta
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'toolu_1',
        status: 'completed',
        rawOutput: [{ type: 'text', text: JSON.stringify({ id: '1:3' }) }],
        _meta: meta
      }
    ])
    expect(shown(expectDefined(call, 'tool part'))).toMatchObject({
      type: 'tool-render',
      input: { jsx: '<Frame />' },
      state: 'done',
      output: { id: '1:3' }
    })
  })

  test('an agent’s own tools keep its title and output', async () => {
    const [call] = await transcript([
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'sh-1',
        title: 'Run ls',
        kind: 'execute',
        status: 'in_progress',
        rawInput: { command: 'ls' }
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'sh-1',
        status: 'failed',
        content: [{ type: 'content', content: { type: 'text', text: 'Permission denied' } }]
      }
    ])
    expect(shown(expectDefined(call, 'tool part'))).toMatchObject({
      type: 'tool-Run ls',
      state: 'error',
      errorText: 'Permission denied'
    })
  })

  test('a tool_call that arrives already failed ends with its error', async () => {
    const [call] = await transcript([
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'mcp_startup.open-pencil',
        title: 'mcp__open-pencil__startup',
        kind: 'other',
        status: 'failed',
        content: [{ type: 'content', content: { type: 'text', text: 'failed to start' } }]
      }
    ])
    expect(shown(expectDefined(call, 'tool part'))).toMatchObject({
      state: 'error',
      errorText: 'failed to start'
    })
  })

  test('non-text content and other updates add nothing', async () => {
    const parts = await transcript([
      {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'image',
          mimeType: 'image/png',
          data: '',
          uri: 'https://example.com/a.png'
        }
      },
      { sessionUpdate: 'available_commands_update', availableCommands: [] },
      text('')
    ])
    expect(parts).toEqual([])
  })
})

describe('an agent turn’s usage', () => {
  test('counts cached tokens as input, as the AI SDK does, and keeps them apart', () => {
    // As Codex and Claude Code report a short turn: fresh input apart from the cache.
    expect(
      agentTurnUsage(
        {
          inputTokens: 13808,
          cachedReadTokens: 12288,
          cachedWriteTokens: 0,
          outputTokens: 6,
          totalTokens: 26102
        },
        'gpt-6.1-sol[low]'
      )
    ).toEqual({
      model: 'gpt-6.1-sol[low]',
      inputTokens: 26096,
      outputTokens: 6,
      cacheReadTokens: 12288,
      cacheWriteTokens: 0
    })
    expect(
      agentTurnUsage(
        {
          inputTokens: 2,
          cachedReadTokens: 12211,
          cachedWriteTokens: 28866,
          outputTokens: 6,
          totalTokens: 41085
        },
        null
      )
    ).toMatchObject({ model: null, inputTokens: 41079, cacheWriteTokens: 28866 })
  })

  test('leaves cache values unreported when the agent sends none', () => {
    expect(agentTurnUsage({ inputTokens: 10, outputTokens: 2, totalTokens: 12 }, null)).toEqual({
      model: null,
      inputTokens: 10,
      outputTokens: 2,
      cacheReadTokens: null,
      cacheWriteTokens: null
    })
  })
})

describe('formatConnectionError', () => {
  const claudeAgent: ACPAgentDef = {
    id: 'claude-code',
    name: 'Claude Code',
    command: 'claude-agent-acp',
    args: [],
    installCommand: 'npm i -g @agentclientprotocol/claude-agent-acp'
  }

  test('ECONNREFUSED maps to MCP not running', () => {
    const msg = formatConnectionError(new Error('connect ECONNREFUSED 127.0.0.1:7600'))
    expect(msg).toBe('MCP server is not running. Make sure the editor is open.')
  })

  test('fetch failed maps to MCP not running', () => {
    const msg = formatConnectionError(new Error('fetch failed'))
    expect(msg).toBe('MCP server is not running. Make sure the editor is open.')
  })

  test('timeout maps to timeout message', () => {
    const msg = formatConnectionError(new Error('Request timeout after 30s'))
    expect(msg).toBe('MCP server did not respond in time.')
  })

  test('ENOENT maps to install instructions', () => {
    const msg = formatConnectionError(new Error('spawn claude-agent-acp ENOENT'), claudeAgent)
    expect(msg).toBe(
      '"claude-agent-acp" is not installed. Install it with: npm i -g @agentclientprotocol/claude-agent-acp'
    )
  })

  test('other errors pass through', () => {
    const msg = formatConnectionError(new Error('Something unexpected'))
    expect(msg).toBe('Something unexpected')
  })

  test('non-Error values converted to string', () => {
    const msg = formatConnectionError('raw string error')
    expect(msg).toBe('raw string error')
  })
})

describe('buildCrashChunks', () => {
  test('destroying=true returns empty chunks, no session null', () => {
    const result = buildCrashChunks(true, TEXT_ID, false)
    expect(result.chunks).toEqual([])
    expect(result.shouldNullSession).toBe(false)
  })

  test('destroying=false with no text emits error + finish', () => {
    const result = buildCrashChunks(false, TEXT_ID, false)
    expect(result.shouldNullSession).toBe(true)
    expect(result.chunks).toEqual([
      { type: 'error', errorText: 'Agent process exited unexpectedly.' },
      { type: 'finish-step' },
      { type: 'finish', finishReason: 'error' }
    ])
  })

  test('destroying=false with active text emits text-end before error', () => {
    const result = buildCrashChunks(false, TEXT_ID, true)
    expect(result.shouldNullSession).toBe(true)
    expect(result.chunks[0]).toEqual({ type: 'text-end', id: TEXT_ID })
    expect(result.chunks[1]).toEqual({
      type: 'error',
      errorText: 'Agent process exited unexpectedly.'
    })
  })
})
