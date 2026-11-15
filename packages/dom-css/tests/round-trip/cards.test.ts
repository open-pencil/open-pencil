import { describe, expect, it } from 'bun:test'

import { sceneGraphToDesignDocument } from '@open-pencil/dom-css/export'
import { designDocumentToSceneGraph } from '@open-pencil/dom-css/scene-graph'
import {
  computedCardDocument,
  expectElement,
  findTextElement
} from '@open-pencil/test-support/dom-css'

describe('@open-pencil/dom-css conversion', () => {
  it('projects a DesignDOM card into a scene graph', () => {
    const graph = designDocumentToSceneGraph(computedCardDocument)
    const page = graph.getPages()[0]
    expect(page?.name).toBe('DesignDOM')

    const card = page ? graph.getChildren(page.id)[0] : undefined
    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320 + 2 * 24)
    expect(card?.height).toBe(160 + 2 * 24)
    expect(card?.layoutMode).toBe('VERTICAL')
    expect(card?.itemSpacing).toBe(12)
    expect(card?.paddingTop).toBe(24)
    expect(card?.cornerRadius).toBe(16)
    expect(card?.fills[0]?.type).toBe('SOLID')

    const title = card ? graph.getChildren(card.id)[0] : undefined
    expect(title?.type).toBe('TEXT')
    expect(title?.text).toBe('OpenPencil')
    expect(title?.fontSize).toBe(24)
    expect(title?.fontWeight).toBe(700)
  })

  it('exports multiline text with preserved whitespace', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'p',
          attrs: {},
          inlineStyle: { width: '160px' },
          children: [{ type: 'text', text: 'Open\nPencil' }]
        }
      ]
    })
    const document = sceneGraphToDesignDocument(graph)
    const text = findTextElement(document.children)

    expect(text?.inlineStyle?.['white-space']).toBe('pre-wrap')
  })

  it('projects a scene graph back into DesignDOM', () => {
    const graph = designDocumentToSceneGraph(computedCardDocument)
    const document = sceneGraphToDesignDocument(graph)
    const page = expectElement(document.children[0])

    const card = expectElement(page.children[0])

    expect(card.tagName).toBe('div')
    expect(card.inlineStyle).toMatchObject({ width: '368px', 'box-sizing': 'border-box' })
    expect(card.inlineStyle?.display).toBe('flex')
    expect(card.inlineStyle?.['flex-direction']).toBe('column')
    expect(card.attrs['data-open-pencil-node-id']).toBeTruthy()

    const title = expectElement(card.children[0])
    expect(title.tagName).toBe('span')
    expect(title.inlineStyle?.['font-size']).toBe('24px')
  })
})
