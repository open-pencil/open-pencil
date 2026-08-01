import { describe, expect, test } from 'bun:test'

import type { Color, Stroke } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'
import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

const NAVY: Color = { r: 2 / 255, g: 26 / 255, b: 59 / 255, a: 1 }

const HIDDEN_STROKE: Stroke = {
  color: { r: 1, g: 0, b: 0, a: 1 },
  weight: 4,
  opacity: 1,
  visible: false,
  align: 'CENTER',
  cap: 'NONE',
  join: 'MITER'
}

const VISIBLE_STROKE: Stroke = {
  color: NAVY,
  weight: 10.126,
  opacity: 1,
  visible: true,
  align: 'CENTER',
  cap: 'NONE',
  join: 'MITER'
}

interface ChildSummary {
  summary: string
}

function setupStrokedChild() {
  const { figma, graph } = setupToolTest()
  const frame = figma.createFrame()
  frame.name = 'Outline'
  frame.resize(200, 200)

  const outline = figma.createRectangle()
  outline.resize(100, 4)
  frame.appendChild(outline)
  graph.updateNode(outline.id, {
    fills: [],
    strokes: [HIDDEN_STROKE, VISIBLE_STROKE]
  })

  return { figma, frameId: frame.id, outlineId: outline.id }
}

describe('describe stroke summaries', () => {
  test('reports the first visible stroke in a child summary', () => {
    const { figma, frameId } = setupStrokedChild()
    const result = getTool('describe').execute(figma, { id: frameId }) as ToolResult
    const children = result.children as ChildSummary[]
    const summary = expectDefined(children[0], 'stroked child summary').summary

    expect(summary).toContain('#021A3B 10.13px stroke')
  })

  test('reports the first visible stroke in the node visual summary', () => {
    const { figma, outlineId } = setupStrokedChild()
    const result = getTool('describe').execute(figma, { id: outlineId }) as ToolResult

    expect(result.visual).toContain('#021A3B 10.13px stroke')
  })
})
