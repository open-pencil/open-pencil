import { describe, expect, it } from 'bun:test'

import { htmlToDesignDocument, htmlToSceneGraph } from '@open-pencil/dom-css'
import { sceneGraphToDesignDocument, serializeHTML } from '@open-pencil/dom-css/export'
import { designDocumentToSceneGraph } from '@open-pencil/dom-css/scene-graph'
import { cardCSS, cardHTML, fixtureCSS, fixtureHTML } from '@open-pencil/test-support/dom-css'

import { engineRuntime } from '../helpers/engine'

describe('HTML and CSS through the HTML engine', () => {
  it('converts HTML and CSS to DesignDOM with one API call', async () => {
    const document = await htmlToDesignDocument(cardHTML, {
      cssText: cardCSS,
      runtime: engineRuntime()
    })
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.computedStyle?.width).toBe('320px')
    expect(card.computedStyle?.['border-top-left-radius']).toBe('16px')
  })

  it('converts HTML and CSS to a scene graph with one API call', async () => {
    const graph = await htmlToSceneGraph(cardHTML, {
      cssText: cardCSS,
      runtime: engineRuntime()
    })
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    // CSS sizes the content box: padding and borders come on top.
    expect(card.width).toBe(320 + 2 * 24 + 2 * 1)
    expect(card.height).toBe(180 + 2 * 24 + 2 * 1)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
    expect(card.paddingLeft).toBe(24)
    expect(card.cornerRadius).toBe(16)
    expect(card.effects[0]?.type).toBe('DROP_SHADOW')
  })

  it('applies embedded HTML style blocks without creating style layers', async () => {
    const graph = await htmlToSceneGraph(
      `<!doctype html>
      <html>
        <head>
          <style>
            .card { display: flex; flex-direction: column; gap: 10px; width: 280px; height: 140px; padding: 20px; }
          </style>
        </head>
        <body><article class="card"><h1>Embedded CSS</h1></article></body>
      </html>`,
      { runtime: engineRuntime() }
    )
    const page = graph.getPages()[0]
    expect(page).toBeDefined()
    if (!page) return
    const card = graph.getChildren(page.id)[0]

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.name).toBe('card')
    expect(card.width).toBe(280 + 2 * 20)
    expect(card.height).toBe(140 + 2 * 20)
    expect(card.itemSpacing).toBe(10)
    expect(card.paddingLeft).toBe(20)
    expect(graph.getChildren(page.id)).toHaveLength(1)
  })

  it('keeps box-like inline controls as editable frames', async () => {
    const graph = await htmlToSceneGraph(fixtureHTML, {
      cssText: fixtureCSS,
      runtime: engineRuntime()
    })
    const page = graph.getPages()[0]
    const shell = page ? graph.getChildren(page.id)[0] : undefined
    expect(shell?.type).toBe('FRAME')
    if (shell?.type !== 'FRAME') return

    const [navbar, input] = graph.getChildren(shell.id)
    expect(navbar?.type).toBe('FRAME')
    expect(input?.type).toBe('FRAME')
    if (navbar?.type !== 'FRAME' || input?.type !== 'FRAME') return
    expect(navbar.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(input.width).toBe(312 + 2 * 12 + 2 * 1)
    expect(input.paddingLeft).toBe(12)

    const badge = graph.getChildren(navbar.id)[1]
    expect(badge?.type).toBe('FRAME')
    if (badge?.type !== 'FRAME') return
    expect(badge.cornerRadius).toBe(9999)
    expect(graph.getChildren(badge.id)[0]?.type).toBe('TEXT')
  })

  it('projects scene graph output back into DesignDOM HTML', async () => {
    const graph = await htmlToSceneGraph(cardHTML, {
      cssText: cardCSS,
      runtime: engineRuntime()
    })
    const document = sceneGraphToDesignDocument(graph)
    const html = serializeHTML(document)

    expect(html).toContain('OpenPencil')
    expect(html).toContain('box-shadow')
  })

  it('projects a manually built DesignDOM document into a scene graph', async () => {
    const runtime = engineRuntime()
    const document = await runtime.computeStyles(runtime.parseHTML(cardHTML), cardCSS)
    const graph = designDocumentToSceneGraph(document)
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.fills[0]?.type).toBe('SOLID')
    expect(card.strokes[0]?.weight).toBe(1)
  })
})
