import { describe, expect, test } from 'bun:test'

import { computeAllLayouts } from '@open-pencil/core/layout'
import { parsePenFile, parseSize, type PenDocument, type PenNode } from '@open-pencil/pen'

function parseLayoutDocument(children: PenNode[]) {
  const document: PenDocument = { version: '2.17', children }
  const graph = parsePenFile(JSON.stringify(document))
  computeAllLayouts(graph)
  return graph
}

function fixedChild(id: string): PenNode {
  return { id, type: 'frame', width: 620, height: 420 }
}

describe('parsePenFile — Pen layout defaults (#564)', () => {
  test('treats an omitted frame layout as horizontal', () => {
    const graph = parseLayoutDocument([
      {
        id: 'screen',
        type: 'frame',
        width: 1440,
        layout: 'vertical',
        children: [
          {
            id: 'section',
            type: 'frame',
            width: 'fill_container',
            gap: 56,
            padding: [72, 80],
            alignItems: 'center',
            children: [
              fixedChild('fixed'),
              {
                id: 'fill',
                type: 'frame',
                width: 'fill_container',
                height: 420
              }
            ]
          }
        ]
      }
    ])

    expect(graph.getNode('section')).toMatchObject({
      layoutMode: 'HORIZONTAL',
      width: 1440,
      height: 564,
      paddingTop: 72,
      paddingRight: 80,
      paddingBottom: 72,
      paddingLeft: 80
    })
    expect(graph.getNode('fixed')).toMatchObject({ x: 80, y: 72, width: 620, height: 420 })
    expect(graph.getNode('fill')).toMatchObject({ x: 756, y: 72, width: 604, height: 420 })
  })

  test.each(['fit_content', 'fit_content(100)'])('maps %s to HUG sizing', (height) => {
    const graph = parseLayoutDocument([
      {
        id: 'section',
        type: 'frame',
        width: 1440,
        height,
        layout: 'horizontal',
        padding: [72, 80],
        children: [fixedChild('fixed')]
      }
    ])

    expect(graph.getNode('section')).toMatchObject({
      counterAxisSizing: 'HUG',
      height: 564
    })
  })

  test('uses the parameterized fit-content value when a frame has no content', () => {
    const graph = parseLayoutDocument([
      {
        id: 'empty',
        type: 'frame',
        width: 'fit_content(240)',
        height: 'fit_content(120)'
      }
    ])

    expect(graph.getNode('empty')).toMatchObject({
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      width: 240,
      height: 120,
      minWidth: 240,
      minHeight: 120
    })
  })

  test('ignores the parameterized fallback when content determines the size', () => {
    const graph = parseLayoutDocument([
      {
        id: 'content-frame',
        type: 'frame',
        width: 'fit_content(240)',
        height: 'fit_content(120)',
        padding: 10,
        children: [{ id: 'content', type: 'frame', width: 20, height: 30 }]
      }
    ])

    expect(graph.getNode('content-frame')).toMatchObject({
      width: 40,
      height: 50,
      minWidth: null,
      minHeight: null
    })
  })

  test('keeps explicit freeform frames out of auto-layout', () => {
    const graph = parseLayoutDocument([
      {
        id: 'freeform',
        type: 'frame',
        layout: 'none',
        children: [fixedChild('fixed')]
      }
    ])

    expect(graph.getNode('freeform')?.layoutMode).toBe('NONE')
  })
})

describe('parseSize — Pen sizing fallbacks (#564)', () => {
  test('preserves parameterized fill-container fallback values', () => {
    expect(parseSize('fill_container(900)', 100)).toEqual({ value: 900, sizing: 'FILL' })
  })

  test('preserves parameterized fit-content fallback metadata', () => {
    expect(parseSize('fit_content(900)', 100)).toEqual({
      value: 900,
      sizing: 'HUG',
      fitContentFallback: 900
    })
  })

  test.each(['fit_content()', 'fit_content(nope)', 'fit_content(100)garbage'])(
    'rejects malformed sizing behavior %s',
    (value) => {
      expect(parseSize(value, 100)).toEqual({ value: 100, sizing: 'FIXED' })
    }
  )
})
