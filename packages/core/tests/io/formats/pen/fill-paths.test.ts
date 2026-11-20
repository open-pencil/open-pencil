import { describe, expect, test } from 'bun:test'

import { layoutAuthoredNodes } from '@open-pencil/core/layout'
import { parsePenFile, type PenNode } from '@open-pencil/pen'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'

function parseLaidOut(children: PenNode[]) {
  return parsePenFile(JSON.stringify({ version: '2.17', children }), {
    layout: (graph) =>
      layoutAuthoredNodes(
        graph,
        graph.getPages().map((page) => page.id)
      )
  })
}

const card: PenNode = {
  id: 'card',
  type: 'frame',
  reusable: true,
  slot: [],
  width: 'fit_content(320)',
  height: 'fit_content(120)',
  layout: 'vertical',
  padding: 24
}

function metric(id: string): PenNode {
  return {
    id,
    type: 'ref',
    ref: 'card',
    width: 'fill_container',
    gap: 0,
    padding: 0,
    children: [
      {
        id: `${id}-content`,
        type: 'frame',
        width: 'fill_container',
        layout: 'vertical',
        gap: 8,
        padding: 16,
        children: [
          { id: `${id}-value`, type: 'text', content: '0%', fontSize: 24 },
          {
            id: `${id}-line`,
            type: 'path',
            geometry: 'M0 16l12-3 13 4 12-6 13 4 12-5 13 4 12-2 13-1',
            viewBox: [0, 0, 100, 24],
            width: 'fill_container',
            height: 24,
            stroke: '#E5487F',
            strokeWidth: 1.5
          }
        ]
      }
    ]
  }
}

describe('parsePenFile — Fill paths', () => {
  test('a Fill path in a metric card of a Fill row takes the card content’s inner width', () => {
    const graph = parseLaidOut([
      { ...card, padding: 16, gap: 12 },
      {
        id: 'screen',
        type: 'frame',
        width: 1000,
        height: 600,
        layout: 'vertical',
        padding: 24,
        children: [
          {
            id: 'column',
            type: 'frame',
            width: 'fill_container',
            layout: 'vertical',
            gap: 24,
            children: [
              {
                id: 'row',
                type: 'frame',
                width: 'fill_container',
                gap: 16,
                children: [metric('cpu'), metric('memory'), metric('disk')]
              }
            ]
          }
        ]
      }
    ])
    const content = getNodeOrThrow(graph, 'cpu-content')
    expect(content.width).toBeGreaterThan(200)
    expect(getNodeOrThrow(graph, 'cpu-line').width).toBeCloseTo(content.width - 32, 0)
  })
})
