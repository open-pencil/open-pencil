import { describe, expect, it } from 'bun:test'

import { designDocumentToSceneGraph } from '#dom-css/import/scene-graph'
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
})
