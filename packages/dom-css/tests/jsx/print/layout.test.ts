import { describe, expect, test } from 'bun:test'

import { makeGraph, pageId, tw } from './helpers'

describe('Tailwind JSX layout classes', () => {
  test('spacing uses v4 multiplier (px / 4)', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 16,
      height: 2
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('w-4')
    expect(jsx).toContain('h-[2px]')
  })

  test('non-standard spacing falls back to arbitrary value', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 37,
      height: 100
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('w-[37px]')
    expect(jsx).toContain('h-25')
  })

  test('1px uses w-px', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 1,
      height: 1
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('w-px')
    expect(jsx).toContain('h-px')
  })

  test('auto-layout frame → flex classes', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Row',
      width: 400,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 16,
      paddingTop: 12,
      paddingRight: 12,
      paddingBottom: 12,
      paddingLeft: 12,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG'
    })
    const jsx = tw(graph, frame.id)
    expect(jsx).toContain('<div')
    expect(jsx).toContain('flex ')
    expect(jsx).not.toContain('flex-col')
    expect(jsx).toContain('gap-4')
    expect(jsx).toContain('p-3')
    expect(jsx).toContain('w-100')
  })

  test('vertical auto-layout', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 320,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED'
    })
    const jsx = tw(graph, frame.id)
    expect(jsx).toContain('flex ')
    expect(jsx).toContain('flex-col')
    expect(jsx).toContain('gap-2')
    expect(jsx).toContain('w-80')
  })

  test('asymmetric padding', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 100,
      height: 100,
      layoutMode: 'HORIZONTAL',
      paddingTop: 8,
      paddingRight: 16,
      paddingBottom: 8,
      paddingLeft: 16,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const jsx = tw(graph, frame.id)
    expect(jsx).toContain('py-2')
    expect(jsx).toContain('px-4')
    expect(jsx).not.toContain('pt-')
    expect(jsx).not.toContain('pb-')
  })

  test('justify and items alignment', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 100,
      height: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisAlign: 'CENTER',
      counterAxisAlign: 'CENTER',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const jsx = tw(graph, frame.id)
    expect(jsx).toContain('justify-center')
    expect(jsx).toContain('items-center')
  })

  test('grow emits grow class', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 400,
      height: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 50,
      layoutGrow: 1
    })
    const jsx = tw(graph, child.id)
    expect(jsx).toContain('grow')
  })

  test('wrap emits flex-wrap', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 400,
      height: 400,
      layoutMode: 'HORIZONTAL',
      layoutWrap: 'WRAP',
      counterAxisSpacing: 12,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const jsx = tw(graph, frame.id)
    expect(jsx).toContain('flex-wrap')
    expect(jsx).toContain('gap-y-3')
  })

  test('grid layout → grid + grid-cols + grid-rows', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Grid',
      width: 400,
      height: 300,
      layoutMode: 'GRID',
      gridTemplateColumns: [
        { sizing: 'FR', value: 1 },
        { sizing: 'FR', value: 1 },
        { sizing: 'FR', value: 1 }
      ],
      gridTemplateRows: [
        { sizing: 'FR', value: 1 },
        { sizing: 'FR', value: 1 }
      ],
      gridColumnGap: 16,
      gridRowGap: 8,
      paddingTop: 12,
      paddingRight: 12,
      paddingBottom: 12,
      paddingLeft: 12
    })
    const jsx = tw(graph, frame.id)
    expect(jsx).toContain('grid ')
    expect(jsx).toContain('grid-cols-3')
    expect(jsx).toContain('grid-rows-2')
    expect(jsx).toContain('gap-x-4')
    expect(jsx).toContain('gap-y-2')
    expect(jsx).toContain('p-3')
    expect(jsx).not.toContain('flex')
  })

  test('grid with mixed tracks uses arbitrary value', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 600,
      height: 400,
      layoutMode: 'GRID',
      gridTemplateColumns: [
        { sizing: 'FIXED', value: 200 },
        { sizing: 'FR', value: 1 },
        { sizing: 'AUTO', value: 0 }
      ],
      gridTemplateRows: [],
      gridColumnGap: 0,
      gridRowGap: 0
    })
    const jsx = tw(graph, frame.id)
    expect(jsx).toContain('grid-cols-[200px_1fr_auto]')
    expect(jsx).not.toContain('grid-rows')
  })

  test('grid child placement → col-start/row-start/col-span', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 400,
      height: 300,
      layoutMode: 'GRID',
      gridTemplateColumns: [
        { sizing: 'FR', value: 1 },
        { sizing: 'FR', value: 1 }
      ],
      gridTemplateRows: [
        { sizing: 'FR', value: 1 },
        { sizing: 'FR', value: 1 }
      ],
      gridColumnGap: 0,
      gridRowGap: 0
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      name: 'Span',
      width: 100,
      height: 50,
      gridPosition: { column: 1, row: 2, columnSpan: 2, rowSpan: 1 }
    })
    const jsx = tw(graph, child.id)
    expect(jsx).toContain('col-start-1')
    expect(jsx).toContain('row-start-2')
    expect(jsx).toContain('col-span-2')
    expect(jsx).not.toContain('row-span')
  })
})
