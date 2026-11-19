import { describe, expect, test } from 'bun:test'

import { sceneNodeToJSX } from '#design-jsx/index'

import { makeGraph, pageId } from './helpers'

describe('sceneNodeToJSX grid layout', () => {
  test('grid layout frame', () => {
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
    const jsx = sceneNodeToJSX(frame.id, graph)
    expect(jsx).toContain('grid')
    expect(jsx).toContain('columns="1fr 1fr 1fr"')
    expect(jsx).toContain('rows="1fr 1fr"')
    expect(jsx).toContain('columnGap={16}')
    expect(jsx).toContain('rowGap={8}')
    expect(jsx).toContain('p={12}')
    expect(jsx).toContain('w={400}')
    expect(jsx).not.toContain('flex')
  })

  test('grid with mixed track sizes', () => {
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
    const jsx = sceneNodeToJSX(frame.id, graph)
    expect(jsx).toContain('columns="200px 1fr auto"')
    expect(jsx).not.toContain('rows=')
    expect(jsx).not.toContain('columnGap')
  })

  test('child grid position', () => {
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
    const jsx = sceneNodeToJSX(child.id, graph)
    expect(jsx).toContain('colStart={1}')
    expect(jsx).toContain('rowStart={2}')
    expect(jsx).toContain('colSpan={2}')
    expect(jsx).not.toContain('rowSpan')
  })
})
