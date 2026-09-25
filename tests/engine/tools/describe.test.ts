import { describe, expect, test } from 'bun:test'

import type { Color, Fill, Stroke } from '@open-pencil/scene-graph'

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

interface DescribedIssue {
  message: string
  severity?: string
}

function hex(value: string): Color {
  const channel = (offset: number) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255
  return { r: channel(1), g: channel(3), b: channel(5), a: 1 }
}

function solid(color: string, opacity = 1): Fill {
  return { type: 'SOLID', color: hex(color), opacity, visible: true }
}

function describeTextOnBackground(
  textColor: string,
  backgroundColor: string,
  fontSize: number,
  fontWeight = 400,
  textOpacity = 1
): DescribedIssue[] {
  const { figma, graph } = setupToolTest()
  const frame = figma.createFrame()
  frame.name = 'Button'
  frame.resize(200, 60)
  graph.updateNode(frame.id, { fills: [solid(backgroundColor)] })

  const label = figma.createText()
  label.name = 'Label'
  frame.appendChild(label)
  graph.updateNode(label.id, { fills: [solid(textColor, textOpacity)], fontSize, fontWeight })

  const result = getTool('describe').execute(figma, { id: frame.id }) as ToolResult
  const issues = (result.issues ?? []) as DescribedIssue[]
  return issues.filter((issue) => issue.message.startsWith('"Label"'))
}

describe('describe text contrast', () => {
  test('accepts dark text on a mid-tone background that passes WCAG AA', () => {
    expect(describeTextOnBackground('#14101F', '#FF5FA2', 17, 700)).toEqual([])
  })

  test('reports the ratio and threshold for text below WCAG AA', () => {
    const issues = describeTextOnBackground('#949494', '#FFFFFF', 14)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      message: '"Label" contrast 3.03:1 is below WCAG AA 4.5:1 (#949494 on #FFFFFF)',
      severity: 'error'
    })
  })

  test('measures a translucent text fill as blended with the background', () => {
    expect(describeTextOnBackground('#000000', '#FFFFFF', 14)).toEqual([])
    expect(describeTextOnBackground('#000000', '#FFFFFF', 14, 400, 0.4)[0]?.message).toContain(
      'contrast 2.84:1 is below WCAG AA 4.5:1'
    )
  })

  test('uses the 3:1 threshold for large text', () => {
    expect(describeTextOnBackground('#949494', '#FFFFFF', 24)).toEqual([])
    expect(describeTextOnBackground('#949494', '#FFFFFF', 19, 700)).toEqual([])
    expect(describeTextOnBackground('#B0B0B0', '#FFFFFF', 24)[0]?.message).toContain(
      'below WCAG AA 3:1'
    )
  })
})
