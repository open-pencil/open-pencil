import { describe, expect, it } from 'bun:test'

import { designDocumentToLayers } from '#dom-css/import/scene-graph'
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

  it('gives text in a box the box’s content box and its line count', () => {
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
    // The 240×72 box less its 16px padding on the top and left; the words span the lines.
    expect(boxes.get(text.id)).toEqual({
      box: rect(16, 16, 224, 56),
      lines: 2,
      extent: rect(16, 16, 200, 40)
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
})
