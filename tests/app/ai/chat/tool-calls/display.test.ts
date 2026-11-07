import { describe, expect, test } from 'bun:test'

import { fromUint8Array } from 'js-base64'

import {
  displayedToolOutput,
  groupMessageParts,
  toolErrorText,
  toolHasInput,
  toolImage,
  toolNodeIds,
  toolSource,
  toolSummary,
  toolWebResults,
  type ChatMessagePart,
  type ToolCallPart
} from '@/app/ai/chat/tool-calls/display'
import { classifyToolState, isMCPToolName, toolCallState } from '@/components/chat/tool/state'

function call(part: Partial<ToolCallPart> & { type: `tool-${string}` }): ToolCallPart {
  return {
    toolCallId: part.type,
    state: 'input-available',
    input: {},
    ...part
  } as ToolCallPart
}

describe('tool call display', () => {
  test('summarizes render calls by their root element and name, even while streaming', () => {
    const partial = call({
      type: 'tool-render',
      state: 'input-streaming',
      input: { jsx: '<Frame name="Pricing" w={1200}>\n  <Text>Pl' }
    })
    expect(toolSummary(partial)).toBe('Frame “Pricing”')
    expect(toolSource(partial)).toEqual({
      code: '<Frame name="Pricing" w={1200}>\n  <Text>Pl',
      language: 'design-jsx'
    })
  })

  test('names a render call only by its root element, not by a named child', () => {
    const unnamedRoot = call({
      type: 'tool-render',
      input: { jsx: '<Frame w={320}>\n  <Text name="Price">$9</Text>\n</Frame>' }
    })
    expect(toolSummary(unnamedRoot)).toBe('Frame')
  })

  test('summarizes scripts by their first line and other calls by a naming field', () => {
    expect(toolSummary(call({ type: 'tool-eval', input: { code: 'const a = 1\nreturn a' } }))).toBe(
      'const a = 1'
    )
    expect(toolSummary(call({ type: 'tool-find_nodes', input: { query: 'Button' } }))).toBe(
      'Button'
    )
    expect(toolSummary(call({ type: 'tool-batch_update', input: { ids: ['1:2', '1:3'] } }))).toBe(
      '2 nodes'
    )
  })

  test('collects targeted and produced node ids, but not deleted ones', () => {
    expect(
      toolNodeIds(
        call({
          type: 'tool-render',
          state: 'output-available',
          input: { replace_id: '1:1' },
          output: { id: '2:1', results: [{ id: '2:2' }] }
        })
      )
    ).toEqual(['1:1', '2:1', '2:2'])
    expect(
      toolNodeIds(
        call({
          type: 'tool-delete_node',
          state: 'output-available',
          input: {},
          output: { deleted: '1:5', id: '1:5' }
        })
      )
    ).toEqual([])
  })

  test('reads errors from failed calls and from error outputs', () => {
    expect(toolErrorText(call({ type: 'tool-x', state: 'output-error', errorText: 'Boom' }))).toBe(
      'Boom'
    )
    expect(
      toolErrorText(
        call({ type: 'tool-x', state: 'output-available', output: { error: 'Not found' } })
      )
    ).toBe('Not found')
  })

  test('shows exported images inline and elides their base64 from the JSON output', () => {
    const base64 = fromUint8Array(new Uint8Array([137, 80, 78, 71]))
    const part = call({
      type: 'tool-export_image',
      state: 'output-available',
      output: { base64, mimeType: 'image/png', width: 10 }
    })
    expect(toolImage(part)).toBe(`data:image/png;base64,${base64}`)
    expect(displayedToolOutput(part)).toEqual({
      base64: `<${base64.length} base64 characters>`,
      mimeType: 'image/png',
      width: 10
    })
    expect(
      toolImage(
        call({
          type: 'tool-export_image',
          state: 'output-available',
          output: { base64, mimeType: 'image/svg+xml' }
        })
      )
    ).toBeNull()
  })

  test('shows the pages a web search found as sources, not its own output', () => {
    const results = [
      {
        url: 'https://example.com/grids',
        title: 'Grids',
        publishedAt: null,
        author: null,
        text: 'Columns and gutters.'
      }
    ]
    const found = call({ type: 'tool-web_search', state: 'output-available', output: { results } })
    expect(toolWebResults(found)).toEqual(results)
    const refused = call({
      type: 'tool-web_search',
      state: 'output-available',
      output: { error: 'Out of credits' }
    })
    expect(toolWebResults(refused)).toBeNull()
    expect(
      toolWebResults(call({ type: 'tool-get_jsx', state: 'output-available', output: { results } }))
    ).toBeNull()
  })

  test('groups consecutive tool calls between other parts', () => {
    const parts: ChatMessagePart[] = [
      { type: 'text', text: 'Plan' },
      call({ type: 'tool-get_selection' }),
      call({ type: 'tool-render' }),
      { type: 'text', text: 'Done' },
      call({ type: 'tool-describe' })
    ]
    expect(
      groupMessageParts(parts).map((group) =>
        group.kind === 'tools' ? group.parts.map(({ index }) => index) : group.index
      )
    ).toEqual([0, [1, 2], 3, [4]])
  })

  test('keeps a run of calls together across the unrendered step boundaries between them', () => {
    const parts: ChatMessagePart[] = [
      call({ type: 'tool-get_selection' }),
      { type: 'step-start' },
      call({ type: 'tool-render' }),
      { type: 'step-start' },
      { type: 'text', text: 'Done' }
    ]
    expect(
      groupMessageParts(parts).map((group) =>
        group.kind === 'tools' ? group.parts.map(({ index }) => index) : group.index
      )
    ).toEqual([[0, 2], 4])
  })

  test('puts each compaction within the reply before the step it kept', () => {
    const parts: ChatMessagePart[] = [
      { type: 'step-start' },
      call({ type: 'tool-render' }),
      { type: 'step-start' },
      call({ type: 'tool-render' }),
      { type: 'step-start' },
      { type: 'text', text: 'Done' }
    ]
    expect(
      groupMessageParts(parts, [1, 2]).map((group) =>
        group.kind === 'compaction' ? `compaction ${group.compaction}` : group.kind
      )
    ).toEqual(['tools', 'compaction 0', 'tools', 'compaction 1', 'part'])
  })
})

describe('toolHasInput', () => {
  test('counts source or any argument as input', () => {
    expect(toolHasInput(call({ type: 'tool-render', input: { jsx: '<Frame />' } }))).toBe(true)
    expect(toolHasInput(call({ type: 'tool-get_node', input: { id: '1:2' } }))).toBe(true)
    expect(toolHasInput(call({ type: 'tool-get_selection', input: {} }))).toBe(false)
    expect(toolHasInput(call({ type: 'tool-get_selection', input: undefined }))).toBe(false)
  })
})

describe('classifyToolState', () => {
  test('recognizes MCP tools by their names', () => {
    expect(isMCPToolName('mcp__server__search')).toBe(true)
    expect(isMCPToolName('get_nodes')).toBe(false)
  })

  test('treats omitted and false MCP isError as success', () => {
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-available',
        output: { content: [{ type: 'text', text: 'ok' }] }
      })
    ).toBe('done')
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-available',
        output: { content: [], isError: false }
      })
    ).toBe('done')
  })

  test('treats true MCP isError as an error', () => {
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-available',
        output: { content: [], isError: true }
      })
    ).toBe('error')
  })

  test('does not classify non-MCP content objects as MCP results', () => {
    expect(
      classifyToolState({
        toolName: 'get_nodes',
        state: 'output-available',
        output: { content: [] }
      })
    ).toBe('done')
  })

  test('preserves generic error precedence', () => {
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-available',
        output: { content: [], error: 'failed' }
      })
    ).toBe('error')
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-error',
        output: { content: [] }
      })
    ).toBe('error')
  })
})

describe('toolCallState', () => {
  test('classifies a chat part by its tool name, state, and output', () => {
    const part = (fields: Partial<ToolCallPart>) =>
      ({ type: 'tool-diff_apply', toolCallId: 'call', input: {}, ...fields }) as ToolCallPart
    expect(toolCallState(part({ state: 'input-streaming' }))).toBe('pending')
    expect(toolCallState(part({ state: 'output-available', output: { applied: 1 } }))).toBe('done')
    expect(
      toolCallState(part({ state: 'output-available', output: { error: 'Patch does not apply' } }))
    ).toBe('error')
  })
})
