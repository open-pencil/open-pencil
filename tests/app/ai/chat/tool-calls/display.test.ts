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
  type ChatMessagePart,
  type ToolCallPart
} from '@/app/ai/chat/tool-calls/display'

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
})

describe('toolHasInput', () => {
  test('counts source or any argument as input', () => {
    expect(toolHasInput(call({ type: 'tool-render', input: { jsx: '<Frame />' } }))).toBe(true)
    expect(toolHasInput(call({ type: 'tool-get_node', input: { id: '1:2' } }))).toBe(true)
    expect(toolHasInput(call({ type: 'tool-get_selection', input: {} }))).toBe(false)
    expect(toolHasInput(call({ type: 'tool-get_selection', input: undefined }))).toBe(false)
  })
})
