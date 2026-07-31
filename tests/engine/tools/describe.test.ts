import { describe, expect, test } from 'bun:test'

import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

const NAVY = { r: 0.00784313725490196, g: 0.10196078431372549, b: 0.23137254901960785, a: 1 }

function setupStrokedChild() {
  const { figma, graph } = setupToolTest()
  const frame = figma.createFrame()
  frame.name = 'Outline'
  frame.resize(200, 200)

  const line = figma.createRectangle()
  line.resize(100, 4)
  frame.appendChild(line)
  graph.updateNode(line.id, {
    fills: [],
    strokes: [
      {
        color: NAVY,
        weight: 10,
        opacity: 1,
        visible: true,
        align: 'CENTER',
        cap: 'NONE',
        join: 'MITER'
      }
    ]
  })

  return { figma, frameId: frame.id, lineId: line.id }
}

describe('describe', () => {
  test('reports stroke colour and weight on a child summary', () => {
    // An outline drawing carries its entire appearance in the stroke. The
    // container summary omitted strokes altogether, so a correctly stroked
    // path was indistinguishable from an empty one and agents threw the
    // render away and started over.
    const { figma, frameId } = setupStrokedChild()
    const result = getTool('describe').execute(figma, { id: frameId }) as ToolResult

    const summary = (result.children as { summary: string }[])[0].summary
    expect(summary).toContain('#021A3B')
    expect(summary).toContain('10px stroke')
  })

  test('reports the stroke in the visual field of the node itself', () => {
    const { figma, lineId } = setupStrokedChild()
    const result = getTool('describe').execute(figma, { id: lineId }) as ToolResult

    expect(result.visual).toContain('#021A3B')
    expect(result.visual).not.toBe('no visual styles')
  })
})
