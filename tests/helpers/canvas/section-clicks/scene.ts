import type { Fill, SceneGraph } from '@open-pencil/scene-graph'

const WHITE: Fill[] = [
  { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }
]

/** The section Figma desktop 126 was clicked on: an empty frame and one holding a rectangle. */
export function createSectionClickScene(graph: SceneGraph, pageId: string) {
  const section = graph.createNode('SECTION', pageId, {
    name: 'Section',
    width: 800,
    height: 500,
    fills: WHITE
  })
  graph.createNode('FRAME', section.id, {
    name: 'Empty',
    x: 50,
    y: 80,
    width: 200,
    height: 150,
    fills: WHITE
  })
  const full = graph.createNode('FRAME', section.id, {
    name: 'Full',
    x: 300,
    y: 80,
    width: 200,
    height: 150,
    fills: WHITE
  })
  graph.createNode('RECTANGLE', full.id, { name: 'Child', x: 10, y: 10, width: 40, height: 40 })
}

const SWATCH: Fill[] = [
  { type: 'SOLID', color: { r: 0.3, g: 0.5, b: 0.8, a: 1 }, opacity: 1, visible: true }
]
const LABEL: Fill[] = [
  { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, opacity: 1, visible: true }
]

/**
 * Two sections of swatch rows, as the shadcn kit's Foundations page lays them out and Figma
 * desktop 126 was clicked on: section > unfilled auto layout frame > rows > cards > swatch. Rows
 * are named `<section> Row <n>`, swatches `<row> Card <n>`.
 */
export function createSwatchRows(graph: SceneGraph, pageId: string) {
  const build = (section: string, y: number) => {
    const sectionNode = graph.createNode('SECTION', pageId, {
      name: section,
      y,
      width: 760,
      height: 260,
      fills: WHITE
    })
    const rows = graph.createNode('FRAME', sectionNode.id, {
      name: 'Rows',
      x: 40,
      y: 40,
      width: 680,
      height: 180,
      fills: [],
      layoutMode: 'VERTICAL',
      itemSpacing: 20
    })
    const swatches: Record<string, string> = {}
    for (const r of [1, 2]) {
      const row = graph.createNode('FRAME', rows.id, {
        name: `${section} Row ${r}`,
        y: (r - 1) * 100,
        width: 680,
        height: 80,
        fills: [],
        layoutMode: 'HORIZONTAL',
        itemSpacing: 20
      })
      for (const c of [1, 2, 3]) {
        const card = graph.createNode('FRAME', row.id, {
          name: `Card ${c}`,
          x: (c - 1) * 140,
          width: 120,
          height: 80,
          fills: [],
          layoutMode: 'VERTICAL',
          itemSpacing: 8
        })
        const swatch = graph.createNode('RECTANGLE', card.id, {
          name: `${row.name} Card ${c}`,
          width: 120,
          height: 60,
          fills: SWATCH
        })
        graph.createNode('RECTANGLE', card.id, {
          name: 'Label',
          y: 68,
          width: 120,
          height: 12,
          fills: LABEL
        })
        swatches[swatch.name] = swatch.id
      }
    }
    return { section: sectionNode.id, swatches }
  }
  const light = build('Light', 0)
  const dark = build('Dark', 300)
  return {
    light: light.section,
    lightSwatch: light.swatches['Light Row 1 Card 2'],
    lightRowTwoSwatch: light.swatches['Light Row 2 Card 3'],
    dark: dark.section,
    darkSwatch: dark.swatches['Dark Row 2 Card 1']
  }
}
