import { describe, expect, test } from 'bun:test'

import { sceneGraphFromStyledHTML } from '@open-pencil/core/io/formats/html/layers'
import type {
  DesignElement,
  DesignLayout,
  DesignNode,
  DesignStyleDeclaration
} from '@open-pencil/dom-css'

function element(
  computedStyle: DesignStyleDeclaration,
  layout: DesignLayout,
  children: DesignNode[] = []
): DesignElement {
  return { type: 'element', tagName: 'div', attrs: {}, children, computedStyle, layout }
}

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })
const box = (width: number, height: number) => ({ width: `${width}px`, height: `${height}px` })

describe('laying out HTML from its captured layout', () => {
  test('places a layout auto layout cannot express where the page had it', async () => {
    // A two-column grid: the importer stacks its children, the page puts them side by side.
    const grid = element({ display: 'grid', ...box(400, 100) }, { box: rect(0, 0, 400, 100) }, [
      element(box(180, 100), { box: rect(0, 0, 180, 100) }),
      element(box(200, 100), { box: rect(200, 0, 200, 100) })
    ])
    const graph = await sceneGraphFromStyledHTML({ type: 'document', children: [grid] })
    const gridLayer = graph.getChildren(graph.getPages()[0].id)[0]
    const [first, second] = graph.getChildren(gridLayer.id)

    expect(gridLayer).toMatchObject({ layoutMode: 'NONE', width: 400, height: 100 })
    expect(first).toMatchObject({ x: 0, y: 0, width: 180, height: 100 })
    expect(second).toMatchObject({ x: 200, y: 0, width: 200, height: 100 })
  })

  test('keeps auto layout where it lands the children where the page did', async () => {
    const row = element(
      {
        display: 'flex',
        'column-gap': '20px',
        gap: '20px',
        'padding-left': '10px',
        ...box(300, 50)
      },
      { box: rect(0, 0, 310, 50) },
      [
        element(box(40, 50), { box: rect(10, 0, 40, 50) }),
        element(box(60, 50), { box: rect(70, 0, 60, 50) })
      ]
    )
    const graph = await sceneGraphFromStyledHTML({ type: 'document', children: [row] })
    const rowLayer = graph.getChildren(graph.getPages()[0].id)[0]
    const [first, second] = graph.getChildren(rowLayer.id)

    expect(rowLayer.layoutMode).toBe('HORIZONTAL')
    expect(rowLayer.itemSpacing).toBe(20)
    expect(first).toMatchObject({ x: 10, width: 40 })
    expect(second).toMatchObject({ x: 70, width: 60 })
  })

  test('puts top-level elements where the page stacked them', async () => {
    const graph = await sceneGraphFromStyledHTML({
      type: 'document',
      children: [
        element(box(1440, 64), { box: rect(0, 0, 1440, 64) }),
        element(box(1440, 300), { box: rect(0, 96, 1440, 300) })
      ]
    })
    const [header, main] = graph.getChildren(graph.getPages()[0].id)

    expect(header).toMatchObject({ x: 0, y: 0, width: 1440, height: 64 })
    expect(main).toMatchObject({ x: 0, y: 96, width: 1440, height: 300 })
  })

  test('keeps text the page set on one line on one line', async () => {
    const label = element(
      { 'padding-left': '12px', ...box(60, 20) },
      { box: rect(0, 0, 72, 20), lines: [rect(12, 2, 40, 16)] },
      [{ type: 'text', text: 'Docs' }]
    )
    const graph = await sceneGraphFromStyledHTML({ type: 'document', children: [label] })
    const labelLayer = graph.getChildren(graph.getPages()[0].id)[0]
    const text = graph.getChildren(labelLayer.id)[0]

    // It sizes to its words, so a fallback font wider than the page's does not wrap it.
    expect(text).toMatchObject({ type: 'TEXT', textAutoResize: 'WIDTH_AND_HEIGHT' })
  })

  test('moves a centered line to where its words were', async () => {
    // Block flow keeps a line at the left edge; the page centred it.
    const label = element(
      { 'text-align': 'center', ...box(300, 20) },
      { box: rect(0, 0, 300, 20), lines: [rect(130, 2, 40, 16)] },
      [{ type: 'text', text: 'Docs' }]
    )
    const graph = await sceneGraphFromStyledHTML({ type: 'document', children: [label] })
    const labelLayer = graph.getChildren(graph.getPages()[0].id)[0]
    const text = graph.getChildren(labelLayer.id)[0]

    expect(text.x).toBe(130)
  })

  test('keeps auto layout for a line that starts where its words did', async () => {
    const label = element(box(300, 20), { box: rect(0, 0, 300, 20), lines: [rect(0, 2, 40, 16)] }, [
      { type: 'text', text: 'Docs' }
    ])
    const graph = await sceneGraphFromStyledHTML({ type: 'document', children: [label] })
    const labelLayer = graph.getChildren(graph.getPages()[0].id)[0]

    expect(labelLayer.layoutMode).toBe('VERTICAL')
  })
})
