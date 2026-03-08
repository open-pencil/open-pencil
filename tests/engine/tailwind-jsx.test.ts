import { describe, expect, test } from 'bun:test'

import { SceneGraph, sceneNodeToJSX, selectionToJSX } from '@open-pencil/core'

function makeGraph() {
  const graph = new SceneGraph()
  graph.createNode('CANVAS', graph.rootId, { name: 'Page 1' })
  return graph
}

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function tw(graph: SceneGraph, nodeId: string) {
  return sceneNodeToJSX(nodeId, graph, 'tailwind')
}

describe('Tailwind JSX export', () => {
  test('basic rectangle — div with w/h', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Box',
      width: 100,
      height: 48
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('<div')
    expect(jsx).toContain('data-name="Box"')
    expect(jsx).toContain('w-25')
    expect(jsx).toContain('h-12')
    expect(jsx).not.toContain('<Rectangle')
  })

  test('spacing uses v4 multiplier (px / 4)', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 16,
      height: 2
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('w-4')
    expect(jsx).toContain('h-0.5')
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
    expect(jsx).toContain('border-0.5')
    expect(jsx).toContain('border-[#FF0000]')
  })

  test('text node uses <p> with text classes', () => {
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Title',
      width: 200,
      height: 24,
      text: 'Hello World',
      fontSize: 18,
      fontWeight: 700,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('<p')
    expect(jsx).toContain('text-lg')
    expect(jsx).toContain('font-bold')
    expect(jsx).toContain('text-black')
    expect(jsx).toContain('>Hello World</p>')
    expect(jsx).not.toContain('<Text')
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
    expect(jsx).toMatch(/\brounded\b/)
    expect(jsx).not.toContain('rounded-')
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
    expect(jsx).toContain('rounded-tl-lg')
    expect(jsx).toContain('rounded-bl-lg')
    expect(jsx).not.toContain('rounded-tr')
    expect(jsx).not.toContain('rounded-br')
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
    expect(jsx).toContain('opacity-[0.37]')
    expect(jsx).toContain('rotate-[13deg]')
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
    expect(tw(graph, node.id)).toContain('shadow-[0px_4px_8px_rgba(0,0,0,0.25)]')
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
    expect(tw(graph, node.id)).toContain('shadow-[inset_1px_2px_3px_4px_rgba(255,0,0,0.5)]')
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
    expect(tw(graph, node.id)).toContain("font-['IBM Plex Sans']")
  })

  test('section uses <section> tag', () => {
    const graph = makeGraph()
    const node = graph.createNode('SECTION', pageId(graph), {
      width: 800,
      height: 600
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('<section')
  })

  test('frame with children renders nested', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Card',
      width: 320,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95, a: 1 }, opacity: 1, visible: true }],
      cornerRadius: 12
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Title',
      width: 200,
      height: 20,
      text: 'Card Title',
      fontSize: 16,
      fontWeight: 700,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const jsx = tw(graph, frame.id)
    expect(jsx).toContain('<div')
    expect(jsx).toContain('flex flex-col')
    expect(jsx).toContain('gap-2')
    expect(jsx).toContain('rounded-xl')
    expect(jsx).toContain('  <p')
    expect(jsx).toContain('text-base')
    expect(jsx).toContain('font-bold')
    expect(jsx).toContain('>Card Title</p>')
    expect(jsx).toContain('</div>')
  })

  test('selectionToJSX with tailwind format', () => {
    const graph = makeGraph()
    const a = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'A',
      width: 40,
      height: 40
    })
    const b = graph.createNode('ELLIPSE', pageId(graph), {
      name: 'B',
      width: 80,
      height: 80
    })
    const jsx = selectionToJSX([a.id, b.id], graph, 'tailwind')
    expect(jsx).toContain('<div')
    expect(jsx).not.toContain('<Rectangle')
    expect(jsx).not.toContain('<Ellipse')
    expect(jsx).toContain('\n\n')
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

  test('default values are omitted', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      opacity: 1,
      rotation: 0,
      cornerRadius: 0
    })
    const jsx = tw(graph, node.id)
    expect(jsx).not.toContain('opacity')
    expect(jsx).not.toContain('rotate')
    expect(jsx).not.toContain('rounded')
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
