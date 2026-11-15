import { describe, expect, it } from 'bun:test'

import { designDocumentToSceneGraph } from '#dom-css/import/scene-graph'
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
})
