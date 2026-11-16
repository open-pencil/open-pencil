import { describe, expect, it } from 'bun:test'

import { designDocumentToLayers, designDocumentToSceneGraph } from '#dom-css/import/scene-graph'
import type { DesignElement, DesignStyleDeclaration } from '#dom-css/types'

function box(computedStyle: DesignStyleDeclaration, children: DesignElement[] = []): DesignElement {
  return { type: 'element', tagName: 'div', attrs: {}, children, computedStyle }
}

const item = (style: DesignStyleDeclaration = {}) =>
  box({ display: 'block', width: '100px', height: '50px', ...style }, [])

function layers(grid: DesignElement) {
  const graph = designDocumentToSceneGraph({ type: 'document', children: [grid] })
  const [gridLayer] = graph.getChildren(graph.getPages()[0].id)
  return { gridLayer, itemLayers: graph.getChildren(gridLayer.id) }
}

const GRID = { display: 'grid', width: '400px', height: '200px', 'grid-template-columns': 'none' }

describe('grid import', () => {
  it('centers a lone item both ways by place-items', () => {
    const { gridLayer, itemLayers } = layers(
      box({ ...GRID, 'align-items': 'center', 'justify-items': 'center' }, [item()])
    )

    expect(gridLayer).toMatchObject({ layoutMode: 'VERTICAL', primaryAxisAlign: 'CENTER' })
    expect(itemLayers[0].layoutAlignSelf).toBe('CENTER')
  })

  it('packs rows by align-content and puts each item by its own justify-self', () => {
    const { gridLayer, itemLayers } = layers(
      box({ ...GRID, 'align-content': 'end', 'justify-items': 'center', 'row-gap': '8px' }, [
        item(),
        item({ 'justify-self': 'end' })
      ])
    )

    expect(gridLayer).toMatchObject({ primaryAxisAlign: 'MAX', itemSpacing: 8 })
    expect(itemLayers.map((layer) => layer.layoutAlignSelf)).toEqual(['CENTER', 'MAX'])
  })

  it('leaves the rows of several items to their own rows when only align-items is set', () => {
    const { gridLayer } = layers(box({ ...GRID, 'align-items': 'center' }, [item(), item()]))

    expect(gridLayer.primaryAxisAlign).toBe('MIN')
  })

  it('aligns nothing in a grid of several columns, which a stack cannot hold', () => {
    const { gridLayer, itemLayers } = layers(
      box({ ...GRID, 'grid-template-columns': '200px 200px', 'place-items': 'center' }, [
        item({ 'justify-self': 'center' }),
        item()
      ])
    )

    expect(gridLayer.primaryAxisAlign).toBe('MIN')
    expect(itemLayers[0].layoutAlignSelf).not.toBe('CENTER')
  })
  it('puts a lone item by justify-content in a column the grid names none of, which hugs it', () => {
    const { itemLayers } = layers(
      box({ ...GRID, 'justify-content': 'end', 'justify-items': 'center' }, [item()])
    )

    expect(itemLayers[0].layoutAlignSelf).toBe('MAX')
  })

  it('leaves an item narrower than its narrow column to placement, rows still aligned down', () => {
    const { gridLayer, itemLayers } = layers(
      box(
        {
          ...GRID,
          'grid-template-columns': '200px',
          'justify-content': 'end',
          'justify-items': 'center',
          'align-content': 'center'
        },
        [item()]
      )
    )

    expect(gridLayer.primaryAxisAlign).toBe('CENTER')
    expect(itemLayers[0].layoutAlignSelf).not.toBe('CENTER')
  })

  it('aligns items in a column as wide as the grid, as a browser resolves 1fr', () => {
    const { itemLayers } = layers(
      box({ ...GRID, 'grid-template-columns': '400px', 'justify-items': 'center' }, [item()])
    )

    expect(itemLayers[0].layoutAlignSelf).toBe('CENTER')
  })

  it('keeps a paragraph alone in a grid an item of its own, which the grid aligns', () => {
    const paragraph: DesignElement = {
      type: 'element',
      tagName: 'p',
      attrs: {},
      children: [{ type: 'text', text: 'Hello' }],
      computedStyle: { display: 'block' }
    }
    const { itemLayers } = layers(
      box({ ...GRID, 'place-items': 'center', 'justify-items': 'center' }, [paragraph])
    )

    expect(itemLayers.map((layer) => [layer.type, layer.layoutAlignSelf])).toEqual([
      ['TEXT', 'CENTER']
    ])
  })
  it('puts a lone item as wide as its narrow column where justify-content puts the column', () => {
    const { itemLayers } = layers(
      box({ ...GRID, 'grid-template-columns': '100px', 'justify-content': 'center' }, [item()])
    )

    expect(itemLayers[0].layoutAlignSelf).toBe('CENTER')
  })
  it('leaves a lone item in one of several rows to its row, not the whole grid', () => {
    const { gridLayer, itemLayers } = layers(
      box(
        {
          ...GRID,
          'grid-template-rows': '100px 100px',
          'place-items': 'center',
          'align-items': 'center',
          'justify-items': 'center'
        },
        [item()]
      )
    )

    expect(gridLayer.primaryAxisAlign).toBe('MIN')
    expect(itemLayers[0].layoutAlignSelf).toBe('CENTER')
  })
  it('counts named lines as no rows or columns', () => {
    const { gridLayer, itemLayers } = layers(
      box(
        {
          ...GRID,
          'grid-template-rows': '[start] 200px [end]',
          'grid-template-columns': '[a b] 400px [c]',
          'align-items': 'center',
          'justify-items': 'center'
        },
        [item()]
      )
    )

    expect(gridLayer.primaryAxisAlign).toBe('CENTER')
    expect(itemLayers[0].layoutAlignSelf).toBe('CENTER')
  })
  it('lays a grid of several columns out as a grid layer, each item in the area it was laid out in', () => {
    const at = (x: number, y: number, width: number, height: number) => ({
      layout: { box: { x, y, width, height } }
    })
    const cellItem = (style: DesignStyleDeclaration = {}) =>
      box({ display: 'block', 'background-color': 'rgb(200, 200, 200)', ...style })
    const grid: DesignElement = {
      ...box(
        {
          display: 'grid',
          width: '320px',
          'grid-template-columns': '100px 100px 100px',
          'grid-template-rows': '40px 20px',
          'column-gap': '10px',
          'row-gap': '8px'
        },
        [
          { ...cellItem(), ...at(0, 0, 100, 40) },
          { ...cellItem({ width: '60px', height: '20px' }), ...at(110, 0, 60, 20) },
          { ...cellItem(), ...at(220, 0, 100, 40) },
          { ...cellItem(), ...at(0, 48, 210, 20) }
        ]
      ),
      ...at(0, 0, 320, 68)
    }
    const { graph } = designDocumentToLayers({ type: 'document', children: [grid] })
    const [gridLayer] = graph.getChildren(graph.getPages()[0].id)
    const items = graph.getChildren(gridLayer.id)

    expect(gridLayer).toMatchObject({ layoutMode: 'GRID', gridColumnGap: 10, gridRowGap: 8 })
    expect(gridLayer.gridTemplateColumns.map((track) => track.value)).toEqual([100, 100, 100])
    expect(gridLayer.gridTemplateRows.map((track) => track.value)).toEqual([40, 20])
    expect(items.map((item) => item.gridPosition)).toEqual([
      { column: 1, columnSpan: 1, row: 1, rowSpan: 1 },
      { column: 2, columnSpan: 1, row: 1, rowSpan: 1 },
      { column: 3, columnSpan: 1, row: 1, rowSpan: 1 },
      { column: 1, columnSpan: 2, row: 2, rowSpan: 1 }
    ])
    // Stretched items fill their areas; one with a size of its own keeps it at the start.
    expect([items[0].layoutGrow, items[0].layoutAlignSelf]).toEqual([1, 'STRETCH'])
    expect([items[1].layoutGrow, items[1].layoutAlignSelf]).toEqual([0, 'AUTO'])
  })

  it('keeps a grid that centers its items in their areas a stack, left to placement', () => {
    const { gridLayer } = layers(
      box({ ...GRID, 'grid-template-columns': '200px 200px', 'justify-items': 'center' }, [
        item(),
        item()
      ])
    )

    expect(gridLayer.layoutMode).toBe('VERTICAL')
  })
  it('takes the span an item declares, which a box at the start of its area does not show', () => {
    const at = (x: number, y: number, width: number, height: number) => ({
      layout: { box: { x, y, width, height } }
    })
    const grid: DesignElement = {
      ...box(
        {
          display: 'grid',
          width: '320px',
          'grid-template-columns': '100px 100px 100px',
          'grid-template-rows': '20px',
          'column-gap': '10px'
        },
        [
          {
            ...box({ width: '60px', 'grid-column-start': 'auto', 'grid-column-end': 'span 2' }),
            ...at(0, 0, 60, 20)
          },
          {
            ...box({ 'grid-column-start': '3', 'grid-column-end': 'auto' }),
            ...at(220, 0, 100, 20)
          }
        ]
      ),
      ...at(0, 0, 320, 20)
    }
    const { graph } = designDocumentToLayers({ type: 'document', children: [grid] })
    const [gridLayer] = graph.getChildren(graph.getPages()[0].id)

    expect(graph.getChildren(gridLayer.id).map((item) => item.gridPosition)).toEqual([
      { column: 1, columnSpan: 2, row: 1, rowSpan: 1 },
      { column: 3, columnSpan: 1, row: 1, rowSpan: 1 }
    ])
  })
})
