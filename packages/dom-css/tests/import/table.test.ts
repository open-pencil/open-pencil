import { describe, expect, it } from 'bun:test'

import { designDocumentToLayers, designDocumentToSceneGraph } from '#dom-css/import/scene-graph'
import type { DesignElement, DesignNode, DesignStyleDeclaration } from '#dom-css/types'

function element(
  tagName: string,
  computedStyle: DesignStyleDeclaration,
  children: DesignNode[] = []
): DesignElement {
  return { type: 'element', tagName, attrs: {}, children, computedStyle }
}

const SEPARATE = { 'border-collapse': 'separate', 'border-spacing': '2px 4px' }

function cell(text: string, style: DesignStyleDeclaration = {}): DesignElement {
  return element(
    'td',
    { display: 'table-cell', 'vertical-align': 'middle', ...SEPARATE, ...style },
    [{ type: 'text', text }]
  )
}

function table(rows: DesignElement[], style: DesignStyleDeclaration = SEPARATE): DesignElement {
  const tableStyle = { display: 'table', ...style }
  const rowGroup = element('tbody', { display: 'table-row-group', ...style }, rows)
  return element('table', tableStyle, [rowGroup])
}

function row(cells: DesignElement[], style: DesignStyleDeclaration = SEPARATE): DesignElement {
  return element('tr', { display: 'table-row', ...style }, cells)
}

function layers(root: DesignElement) {
  const graph = designDocumentToSceneGraph({ type: 'document', children: [root] })
  const [tableLayer] = graph.getChildren(graph.getPages()[0].id)
  const [groupLayer] = graph.getChildren(tableLayer.id)
  const rowLayers = graph.getChildren(groupLayer.id)
  return { graph, tableLayer, groupLayer, rowLayers }
}

describe('table import', () => {
  it('stacks rows and puts cells side by side, with the border spacing between them', () => {
    const { graph, tableLayer, groupLayer, rowLayers } = layers(
      table([row([cell('a'), cell('b')]), row([cell('c'), cell('d')])])
    )

    // The spacing also keeps the cells from the table's edges, across and down.
    expect(tableLayer).toMatchObject({
      layoutMode: 'VERTICAL',
      itemSpacing: 4,
      paddingTop: 4,
      paddingBottom: 4,
      paddingLeft: 2,
      paddingRight: 2
    })
    expect(groupLayer).toMatchObject({ layoutMode: 'VERTICAL', itemSpacing: 4 })
    expect(rowLayers).toHaveLength(2)
    // Cells stretch to their row's height, as table cells do.
    expect(rowLayers[0]).toMatchObject({
      layoutMode: 'HORIZONTAL',
      itemSpacing: 2,
      counterAxisAlign: 'STRETCH'
    })
    expect(graph.getChildren(rowLayers[0].id).map((layer) => layer.type)).toEqual([
      'FRAME',
      'FRAME'
    ])
  })

  it('leaves no spacing between collapsed borders', () => {
    const collapsed = { 'border-collapse': 'collapse', 'border-spacing': '2px 4px' }
    const { tableLayer, rowLayers } = layers(table([row([cell('a')], collapsed)], collapsed))

    expect(tableLayer).toMatchObject({ itemSpacing: 0, paddingTop: 0, paddingLeft: 0 })
    expect(rowLayers[0].itemSpacing).toBe(0)
  })

  it('draws each collapsed border once, centered on the edge the cells share', () => {
    const collapsed = { 'border-collapse': 'collapse', 'border-spacing': '0px' }
    const bordered = {
      ...collapsed,
      'border-style': 'solid',
      'border-width': '2px',
      'border-color': 'rgb(0, 0, 0)',
      padding: '8px'
    }
    const { graph, tableLayer, rowLayers } = layers(
      table([row([cell('a', bordered), cell('b', bordered)], collapsed)], collapsed)
    )
    const [first] = graph.getChildren(rowLayers[0].id)

    // Each cell holds half of the border, its stroke centered on the cell's edge, so two cells'
    // strokes draw one line; the content sits inside its half.
    expect(first.strokes.map((stroke) => stroke.align)).toEqual(['CENTER'])
    expect(first).toMatchObject({ paddingTop: 9, paddingLeft: 9, paddingRight: 9 })
    // The table holds the outer half of the outer borders.
    expect(tableLayer).toMatchObject({
      paddingTop: 1,
      paddingLeft: 1,
      strokesIncludedInLayout: false
    })
  })

  it('places a cell’s content by its vertical-align', () => {
    const { graph, rowLayers } = layers(
      table([
        row([
          cell('top', { 'vertical-align': 'top' }),
          cell('middle'),
          cell('bottom', { 'vertical-align': 'bottom' }),
          cell('baseline', { 'vertical-align': 'baseline' })
        ])
      ])
    )

    expect(graph.getChildren(rowLayers[0].id).map((layer) => layer.primaryAxisAlign)).toEqual([
      'MIN',
      'CENTER',
      'MAX',
      'MIN'
    ])
  })

  it('makes no layers of the columns, which only size the cells under them', () => {
    const columns = element('colgroup', { display: 'table-column-group' }, [
      element('col', { display: 'table-column', width: '100px' })
    ])
    const root = table([row([cell('a')])])
    root.children.unshift(columns)
    const graph = designDocumentToSceneGraph({ type: 'document', children: [root] })
    const [tableLayer] = graph.getChildren(graph.getPages()[0].id)

    expect(graph.getChildren(tableLayer.id).map((layer) => layer.name)).toEqual(['tbody'])
  })
  it('stacks captions by their side around the table box, which draws and spaces the rows', () => {
    const caption = (text: string, side: string) =>
      element('caption', { display: 'table-caption', 'caption-side': side }, [
        { type: 'text', text }
      ])
    const tableStyle = {
      display: 'table',
      ...SEPARATE,
      'background-color': 'rgb(238, 238, 255)',
      'border-top-width': '3px',
      'border-top-style': 'solid',
      'border-top-color': 'rgb(0, 0, 0)'
    }
    const rows = element('tbody', { display: 'table-row-group', ...SEPARATE }, [row([cell('a')])])
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        element('table', tableStyle, [caption('Below', 'bottom'), rows, caption('Above', 'top')])
      ]
    })
    const [tableLayer] = graph.getChildren(graph.getPages()[0].id)
    const [above, box, below] = graph.getChildren(tableLayer.id)

    expect([above.name, box.name, below.name]).toEqual(['caption', 'table box', 'caption'])
    expect(graph.getChildren(above.id).map((text) => text.name)).toEqual(['Above'])
    expect(graph.getChildren(below.id).map((text) => text.name)).toEqual(['Below'])
    // The captions sit outside the table's border, background, and spacing.
    expect(tableLayer).toMatchObject({ layoutMode: 'VERTICAL', itemSpacing: 0, paddingTop: 0 })
    expect(tableLayer.fills).toEqual([])
    expect(tableLayer.strokes).toEqual([])
    expect(box).toMatchObject({ layoutMode: 'VERTICAL', itemSpacing: 4, paddingLeft: 2 })
    expect(box.fills).toHaveLength(1)
    expect(box.strokes).toHaveLength(1)
    expect(graph.getChildren(box.id).map((group) => group.name)).toEqual(['tbody'])
  })
  it('places the table box between its captions where the page laid them out', () => {
    const rect = (y: number, height: number) => ({ x: 0, y, width: 300, height })
    const caption = (side: string, y: number) => ({
      ...element('caption', { display: 'table-caption', 'caption-side': side }, [
        { type: 'text', text: side }
      ]),
      layout: { box: rect(y, 20) }
    })
    const rows = element('tbody', { display: 'table-row-group', ...SEPARATE }, [row([cell('a')])])
    const captioned = {
      ...element('table', { display: 'table', ...SEPARATE }, [
        caption('top', 0),
        rows,
        caption('bottom', 80)
      ]),
      layout: { box: rect(0, 100) }
    }
    const { graph, boxes } = designDocumentToLayers({ type: 'document', children: [captioned] })
    const [tableLayer] = graph.getChildren(graph.getPages()[0].id)
    const box = graph.getChildren(tableLayer.id)[1]

    expect(box.name).toBe('table box')
    expect(boxes.get(box.id)?.box).toEqual(rect(20, 60))
  })
})
