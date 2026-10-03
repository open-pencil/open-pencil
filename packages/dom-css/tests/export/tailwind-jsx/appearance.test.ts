import { describe, expect, test } from 'bun:test'

import { makeGraph, pageId, tw } from './helpers'

describe('Tailwind JSX appearance classes', () => {
  test('fill and stroke', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      strokes: [
        {
          color: { r: 1, g: 0, b: 0, a: 1 },
          weight: 2,
          opacity: 1,
          visible: true,
          align: 'INSIDE' as const
        }
      ]
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('bg-white')
    // twirlwind maps 2px border correctly
    expect(jsx).toContain('border-[#FF0000]')
  })

  test('border radius — named values', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      cornerRadius: 8
    })
    expect(tw(graph, node.id)).toContain('rounded-lg')
  })

  test('border radius — default (4px) omits suffix', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      cornerRadius: 4
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toMatch(/rounded/)
  })

  test('border radius — full', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      cornerRadius: 9999
    })
    expect(tw(graph, node.id)).toContain('rounded-full')
  })

  test('border radius — arbitrary', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      cornerRadius: 5
    })
    expect(tw(graph, node.id)).toContain('rounded-[5px]')
  })

  test('independent corners', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 40,
      cornerRadius: 20,
      independentCorners: true,
      topLeftRadius: 8,
      topRightRadius: 0,
      bottomRightRadius: 0,
      bottomLeftRadius: 8
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toMatch(/rounded/)
    expect(jsx).toMatch(/rounded/)
  })

  test('opacity and rotation', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 50,
      height: 50,
      opacity: 0.5,
      rotation: 45
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('opacity-50')
    expect(jsx).toContain('rotate-45')
  })

  test('non-standard opacity and rotation use arbitrary values', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 50,
      height: 50,
      opacity: 0.37,
      rotation: 13
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('opacity-37')
    expect(jsx).toContain('rotate-13')
  })

  test('overflow hidden', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 100,
      height: 100,
      clipsContent: true
    })
    expect(tw(graph, frame.id)).toContain('overflow-hidden')
  })

  test('shadow emits arbitrary shadow class', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true
        }
      ]
    })
    expect(tw(graph, node.id)).toMatch(/shadow-\[0px_4px_8px/)
  })

  test('inner shadow includes inset and spread', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      effects: [
        {
          type: 'INNER_SHADOW',
          color: { r: 1, g: 0, b: 0, a: 0.5 },
          offset: { x: 1, y: 2 },
          radius: 3,
          spread: 4,
          visible: true
        }
      ]
    })
    expect(tw(graph, node.id)).toMatch(/shadow-\[inset_1px_2px_3px_4px/)
  })

  test('blur emits blur class', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      effects: [
        {
          type: 'LAYER_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 4,
          spread: 0,
          visible: true
        }
      ]
    })
    expect(tw(graph, node.id)).toContain('blur-[4px]')
  })

  test('font size — named values', () => {
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      width: 200,
      height: 24,
      text: 'Hello',
      fontSize: 24,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    expect(tw(graph, node.id)).toContain('text-2xl')
  })

  test('font size — arbitrary', () => {
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      width: 200,
      height: 24,
      text: 'Hello',
      fontSize: 22,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    expect(tw(graph, node.id)).toContain('text-[22px]')
  })

  test('font weight — named values', () => {
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      width: 100,
      height: 20,
      text: 'X',
      fontWeight: 600
    })
    expect(tw(graph, node.id)).toContain('font-semibold')
  })

  test('font family keeps original spaces via arbitrary value', () => {
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      width: 100,
      height: 20,
      text: 'X',
      fontFamily: 'IBM Plex Sans'
    })
    expect(tw(graph, node.id)).toContain('font-[IBM_Plex_Sans]')
  })

  test('white color uses named class', () => {
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      width: 100,
      height: 20,
      text: 'X',
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('text-white')
    expect(jsx).not.toContain('#')
  })
})
