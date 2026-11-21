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

  test('a Fill path read at no width still fills a fixed-width column', () => {
    const graph = parseLaidOut([
      {
        id: 'column',
        type: 'frame',
        width: 300,
        layout: 'vertical',
        children: [
          {
            id: 'line',
            type: 'path',
            geometry: 'M0 16l50-8 50 8',
            viewBox: [0, 0, 100, 24],
            width: 'fill_container(0)',
            height: 24,
            stroke: '#E5487F',
            strokeWidth: 1.5
          }
        ]
      }
    ])
    expect(getNodeOrThrow(graph, 'line').width).toBeCloseTo(300, 0)
  })

  test('a Fill curve whose ends share an x reaches toward its handles, so it is not flat', () => {
    const graph = parseLaidOut([
      {
        id: 'column',
        type: 'frame',
        width: 300,
        layout: 'vertical',
        children: [
          {
            id: 'curve',
            type: 'path',
            geometry: 'M0 0C100 0 100 100 0 100',
            width: 'fill_container(0)',
            height: 100,
            stroke: '#E5487F'
          },
          {
            id: 'vertical',
            type: 'path',
            geometry: 'M0 0L0 100',
            width: 'fill_container(0)',
            height: 100,
            stroke: '#E5487F'
          }
        ]
      }
    ])
    expect(getNodeOrThrow(graph, 'curve').width).toBeCloseTo(300, 0)
    expect(getNodeOrThrow(graph, 'vertical').width).toBe(0)
  })
})
