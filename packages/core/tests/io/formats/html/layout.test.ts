import { describe, expect, test } from 'bun:test'

import { sceneGraphFromStyledHTML } from '@open-pencil/core/io/formats/html/layers'
import type {
  DesignElement,
  DesignLayout,
  DesignNode,
  DesignStyleDeclaration
} from '@open-pencil/dom-css'
import { layoutSizing } from '@open-pencil/scene-graph/layout'

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

  test('fixes the size of a child auto layout sizes otherwise, keeping its parent auto layout', async () => {
    // Boxes left to layout that it hugs to nothing, though the page gave them a size: fixing
    // their sizes lands them where the page did, so the column keeps stacking them.
    const auto = { width: 'auto', height: 'auto' }
    const column = element(
      { display: 'block', width: '200px', height: 'auto' },
      { box: rect(0, 0, 200, 100) },
      [
        element({ display: 'block', ...auto }, { box: rect(0, 0, 200, 40) }),
        element({ display: 'block', ...auto }, { box: rect(0, 40, 200, 60) })
      ]
    )
    const graph = await sceneGraphFromStyledHTML({ type: 'document', children: [column] })
    const columnLayer = graph.getChildren(graph.getPages()[0].id)[0]
    const [first, second] = graph.getChildren(columnLayer.id)

    expect(columnLayer.layoutMode).toBe('VERTICAL')
    expect(first).toMatchObject({ y: 0, height: 40 })
    expect(second).toMatchObject({ y: 40, height: 60 })
  })

  test('lays out again after correcting a fixed size, so its siblings follow and auto layout stays', async () => {
    // The page sized the first box 30px though its style says 20px, as a min-height would.
    const column = element(
      { display: 'block', width: '200px', height: '70px' },
      { box: rect(0, 0, 200, 70) },
      [
        element({ display: 'block', width: '200px', height: '20px' }, { box: rect(0, 0, 200, 30) }),
        element({ display: 'block', width: '200px', height: '40px' }, { box: rect(0, 30, 200, 40) })
      ]
    )
    const graph = await sceneGraphFromStyledHTML({ type: 'document', children: [column] })
    const columnLayer = graph.getChildren(graph.getPages()[0].id)[0]
    const [first, second] = graph.getChildren(columnLayer.id)

    expect(columnLayer.layoutMode).toBe('VERTICAL')
    expect(first).toMatchObject({ y: 0, height: 30 })
    expect(second).toMatchObject({ y: 30, height: 40 })
  })

  test('sets the text of an inline element on its line, sized to its words', async () => {
    // A flex item of inline text: its words are on its one fragment.
    const span: DesignElement = {
      type: 'element',
      tagName: 'span',
      attrs: {},
      children: [{ type: 'text', text: 'Vue.js' }],
      computedStyle: { display: 'inline', width: 'auto', height: 'auto', 'font-size': '16px' },
      layout: { box: rect(10, 8, 47, 24), fragments: [rect(10, 8, 47, 24)] }
    }
    const nav = element(
      { display: 'flex', width: '300px', height: '40px' },
      { box: rect(0, 0, 300, 40) },
      [span]
    )
    const graph = await sceneGraphFromStyledHTML({ type: 'document', children: [nav] })
    const navLayer = graph.getChildren(graph.getPages()[0].id)[0]
    const [text] = graph.getChildren(navLayer.id)

    expect(text).toMatchObject({ type: 'TEXT', textAutoResize: 'WIDTH_AND_HEIGHT', y: 8 })
    expect(text.width).toBeGreaterThan(0)
  })

  test('a single line hugs its words in a column that stretches its children', async () => {
    const label: DesignElement = {
      type: 'element',
      tagName: 'span',
      attrs: {},
      children: [{ type: 'text', text: 'Docs' }],
      computedStyle: { display: 'inline', width: 'auto', height: 'auto', 'font-size': '16px' },
      layout: { box: rect(0, 0, 36, 24), fragments: [rect(0, 0, 36, 24)] }
    }
    // A flex column without align-items stretches its children across.
    const column = element(
      { display: 'flex', 'flex-direction': 'column', width: '300px', height: 'auto' },
      { box: rect(0, 0, 300, 24) },
      [label]
    )
    const graph = await sceneGraphFromStyledHTML({ type: 'document', children: [column] })
    const columnLayer = graph.getChildren(graph.getPages()[0].id)[0]
    const [text] = graph.getChildren(columnLayer.id)

    expect(text.type).toBe('TEXT')
    expect(layoutSizing(graph, text, 'HORIZONTAL')).toBe('HUG')
    expect(text.width).toBeLessThan(300)
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
