import { describe, expect, it } from 'bun:test'

import { designDocumentToLayers, placeLayersFromLayout } from '#dom-css/import/scene-graph'
import type {
  DesignElement,
  DesignLayout,
  DesignNode,
  DesignStyleDeclaration
} from '#dom-css/types'

function element(
  tagName: string,
  computedStyle: DesignStyleDeclaration,
  layout: DesignLayout,
  children: DesignNode[] = []
): DesignElement {
  return { type: 'element', tagName, attrs: {}, children, computedStyle, layout }
}

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })

describe('captured layout in the projection', () => {
  it('records each layer’s captured box and places top-level layers at theirs', () => {
    const header = element('header', { height: '64px' }, { box: rect(0, 0, 1440, 64) })
    const main = element('main', { height: '400px' }, { box: rect(0, 64, 1440, 400) })
    const { graph, boxes } = designDocumentToLayers({ type: 'document', children: [header, main] })
    const [headerLayer, mainLayer] = graph.getChildren(graph.getPages()[0].id)

    expect(boxes.get(headerLayer.id)?.box).toEqual(rect(0, 0, 1440, 64))
    expect(mainLayer).toMatchObject({ x: 0, y: 64, width: 1440, height: 400 })
  })

  it('gives text in a box the box’s content box across, its lines down, and their count', () => {
    const lines = [rect(16, 16, 200, 20), rect(16, 36, 120, 20)]
    const card = element(
      'div',
      { 'padding-top': '16px', 'padding-left': '16px', 'background-color': 'rgb(255, 255, 255)' },
      { box: rect(0, 0, 240, 72), lines },
      [
        { type: 'text', text: 'Two lines of ' },
        element('b', {}, { box: rect(16, 36, 40, 20) }, [{ type: 'text', text: 'text' }])
      ]
    )
    const { graph, boxes } = designDocumentToLayers({ type: 'document', children: [card] })
    const cardLayer = graph.getChildren(graph.getPages()[0].id)[0]
    const text = graph.getChildren(cardLayer.id)[0]

    expect(text.type).toBe('TEXT')
    // Across, the 240px box less its 16px left padding; down, the two lines; the words span them.
    expect(boxes.get(text.id)).toEqual({
      box: rect(16, 16, 224, 40),
      lines: 2,
      extent: rect(16, 16, 200, 40)
    })
  })

  it('gives text that is a flex item of its own the box of its container’s lines', () => {
    // An icon and a run of text in a flex row: the text is an anonymous item, wrapped beside it.
    const lines = [rect(24, 0, 189, 21), rect(24, 21, 170, 21), rect(24, 42, 60, 21)]
    const hint = element(
      'p',
      { display: 'flex', 'column-gap': '8px', gap: '8px' },
      { box: rect(0, 0, 220, 63), lines },
      [
        element('svg', { width: '16px', height: '16px' }, { box: rect(0, 0, 16, 16) }),
        { type: 'text', text: 'This is the app’s own tour, a real .fig file. Open a chapter.' }
      ]
    )
    const { graph, boxes } = designDocumentToLayers({ type: 'document', children: [hint] })
    const row = graph.getChildren(graph.getPages()[0].id)[0]
    const text = graph.getChildren(row.id).find((layer) => layer.type === 'TEXT')

    expect(text && boxes.get(text.id)).toEqual({
      box: rect(24, 0, 189, 63),
      lines: 3,
      extent: rect(24, 0, 189, 63)
    })
  })

  it('records nothing when the layout was not captured', () => {
    const plain: DesignElement = {
      type: 'element',
      tagName: 'div',
      attrs: {},
      children: [],
      computedStyle: { width: '10px', height: '10px' }
    }
    const { boxes } = designDocumentToLayers({ type: 'document', children: [plain] })

    expect(boxes.size).toBe(0)
  })
  it('places the items of a grid layer that land elsewhere than the page put them', () => {
    const cellItem = (x: number) =>
      element('div', { 'background-color': 'rgb(200, 200, 200)' }, { box: rect(x, 0, 100, 40) })
    const grid = element(
      'div',
      {
        display: 'grid',
        width: '210px',
        'grid-template-columns': '100px 100px',
        'grid-template-rows': '40px',
        'column-gap': '10px'
      },
      { box: rect(0, 0, 210, 40) },
      [cellItem(0), cellItem(110)]
    )
    const { graph, boxes } = designDocumentToLayers({ type: 'document', children: [grid] })
    const [gridLayer] = graph.getChildren(graph.getPages()[0].id)
    expect(gridLayer.layoutMode).toBe('GRID')
    // Not laid out, the items still sit at the grid's origin. Sizes are corrected first, then
    // children placed, as the import repeats it.
    for (let pass = 0; pass < 4; pass++) {
      if (placeLayersFromLayout(graph, boxes) === 0) break
    }

    expect(gridLayer.layoutMode).toBe('NONE')
    expect(graph.getChildren(gridLayer.id).map((item) => item.x)).toEqual([0, 110])
  })
  it('spaces a stack as the page did when its children sit an even gap apart', () => {
    const block = (y: number) =>
      element(
        'div',
        { height: '20px', 'background-color': 'rgb(200, 200, 200)' },
        { box: rect(0, y, 100, 20) }
      )
    // 16 px between the first two, while a negative margin pulls the last over the second.
    const stack = element('div', { width: '100px' }, { box: rect(0, 0, 100, 76) }, [
      block(8),
      block(44),
      block(56)
    ])
    const { graph, boxes } = designDocumentToLayers({ type: 'document', children: [stack] })
    const [stackLayer] = graph.getChildren(graph.getPages()[0].id)
    expect(stackLayer.layoutMode).toBe('VERTICAL')
    for (let pass = 0; pass < 4; pass++) {
      if (placeLayersFromLayout(graph, boxes) === 0) break
    }

    // The gaps are 16 and -8, uneven, so the children are placed.
    expect(stackLayer.layoutMode).toBe('NONE')
  })

  it('keeps a stack whose children margins space evenly, with that spacing and padding', () => {
    const block = (y: number) =>
      element(
        'div',
        { height: '20px', 'background-color': 'rgb(200, 200, 200)' },
        { box: rect(0, y, 100, 20) }
      )
    const stack = element('div', { width: '100px' }, { box: rect(0, 0, 100, 96) }, [
      block(8),
      block(44),
      block(80)
    ])
    const { graph, boxes } = designDocumentToLayers({ type: 'document', children: [stack] })
    const [stackLayer] = graph.getChildren(graph.getPages()[0].id)
    placeLayersFromLayout(graph, boxes)

    expect(stackLayer).toMatchObject({ layoutMode: 'VERTICAL', itemSpacing: 16, paddingTop: 8 })
  })
})
