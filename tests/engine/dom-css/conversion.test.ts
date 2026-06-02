import { describe, expect, it } from 'bun:test'

import {
  compileTailwindCSS,
  createHeadlessCSSRuntime,
  designDocumentToSceneGraph,
  sceneGraphToDesignDocument,
  serializeHTML
} from '@open-pencil/dom-css'

import {
  computedCardDocument,
  cssCardCSS,
  cssCardHTML,
  tailwindCardClasses
} from '#tests/helpers/dom-css'

describe('@open-pencil/dom-css conversion', () => {
  it('projects a DesignDOM card into a scene graph', () => {
    const graph = designDocumentToSceneGraph(computedCardDocument)
    const page = graph.getPages()[0]
    expect(page?.name).toBe('DesignDOM')

    const card = page ? graph.getChildren(page.id)[0] : undefined
    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(160)
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

  it('projects a parsed and styled HTML/CSS card into a scene graph', async () => {
    const runtime = createHeadlessCSSRuntime()
    const document = await runtime.computeStyles(runtime.parseHTML(cssCardHTML), cssCardCSS)
    const graph = designDocumentToSceneGraph(document)
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.width).toBe(320)
    expect(card.height).toBe(180)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
    expect(card.paddingLeft).toBe(24)
    expect(card.fills[0]?.type).toBe('SOLID')
    expect(card.strokes[0]?.weight).toBe(1)
    expect(card.effects[0]?.type).toBe('DROP_SHADOW')
    expect(card.effects[0]?.radius).toBe(24)

    const [title, description] = graph.getChildren(card.id)
    expect(title?.type).toBe('TEXT')
    expect(title?.fontSize).toBe(24)
    expect(title?.fills[0]?.type).toBe('SOLID')
    expect(description?.type).toBe('TEXT')
    expect(description?.fontSize).toBe(14)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const html = serializeHTML(roundTrip)
    expect(html).toContain('OpenPencil')
    expect(html).toContain('Design with code-shaped CSS.')
    expect(html).toContain('box-shadow')
  })

  it('maps CSS flex alignment into scene graph auto-layout alignment', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'toolbar' },
          computedStyle: {
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            gap: '8px',
            width: '240px',
            height: '40px'
          },
          children: [
            {
              type: 'element',
              tagName: 'span',
              attrs: {},
              children: [{ type: 'text', text: 'File' }]
            },
            {
              type: 'element',
              tagName: 'span',
              attrs: {},
              children: [{ type: 'text', text: 'Edit' }]
            }
          ]
        }
      ]
    })
    const page = graph.getPages()[0]
    const toolbar = page ? graph.getChildren(page.id)[0] : undefined

    expect(toolbar?.type).toBe('FRAME')
    if (toolbar?.type !== 'FRAME') return
    expect(toolbar.layoutMode).toBe('HORIZONTAL')
    expect(toolbar.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(toolbar.counterAxisAlign).toBe('CENTER')

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') return
    const roundTripToolbar = root.children[0]
    expect(roundTripToolbar?.type).toBe('element')
    if (roundTripToolbar?.type !== 'element') return
    expect(roundTripToolbar.inlineStyle?.['justify-content']).toBe('space-between')
    expect(roundTripToolbar.inlineStyle?.['align-items']).toBe('center')
  })

  it('projects a Tailwind card through generated CSS into a scene graph', async () => {
    const runtime = createHeadlessCSSRuntime()
    const classes = [...tailwindCardClasses]
    const document = await runtime.computeStyles(
      runtime.parseHTML(`<article class="${classes.join(' ')}"><h1>OpenPencil</h1></article>`),
      await compileTailwindCSS(classes)
    )
    const graph = designDocumentToSceneGraph(document)
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.width).toBe(320)
    expect(card.height).toBe(176)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
    expect(card.paddingTop).toBe(24)
    expect(card.cornerRadius).toBe(12)
    expect(card.fills[0]?.type).toBe('SOLID')
  })

  it('projects a scene graph back into DesignDOM', () => {
    const graph = designDocumentToSceneGraph(computedCardDocument)
    const document = sceneGraphToDesignDocument(graph)
    const page = document.children[0]
    expect(page?.type).toBe('element')
    if (page?.type !== 'element') return

    const card = page.children[0]
    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return

    expect(card.tagName).toBe('div')
    expect(card.inlineStyle?.width).toBe('320px')
    expect(card.inlineStyle?.display).toBe('flex')
    expect(card.inlineStyle?.['flex-direction']).toBe('column')
    expect(card.attrs['data-open-pencil-node-id']).toBeTruthy()

    const title = card.children[0]
    expect(title?.type).toBe('element')
    if (title?.type !== 'element') return
    expect(title.tagName).toBe('span')
    expect(title.inlineStyle?.['font-size']).toBe('24px')
  })
})
