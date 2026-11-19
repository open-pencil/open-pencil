import { describe, expect, it } from 'bun:test'

import {
  compileTailwindCSS,
  htmlToDesignDocument,
  htmlToSceneGraph,
  tailwindHTMLToSceneGraph
} from '@open-pencil/dom-css'
import { sceneGraphToDesignDocument, serializeHTML } from '@open-pencil/dom-css/export'
import { designDocumentToSceneGraph } from '@open-pencil/dom-css/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import {
  DOM_CSS_COLORS,
  cssCardCSS,
  cardHTML,
  fixtureMatrixCSS,
  fixtureMatrixHTML,
  tailwindBadgeClasses,
  tailwindCardClasses,
  tailwindTextInputClasses,
  tailwindNavClasses,
  expectFrame,
  firstLayer
} from '@open-pencil/test-support/dom-css'

import { engineRuntime } from '../helpers/engine'

describe('round trips through the HTML engine', () => {
  it('converts HTML and CSS to DesignDOM with one API call', async () => {
    const document = await htmlToDesignDocument(cardHTML, {
      cssText: cssCardCSS,
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
      cssText: cssCardCSS,
      runtime: engineRuntime()
    })
    const card = firstLayer(graph)

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320 + 2 * 24 + 2 * 1)
    expect(card?.layoutMode).toBe('VERTICAL')
  })

  it('converts Tailwind HTML through generated CSS to a scene graph', async () => {
    const classes = [...tailwindCardClasses]
    const graph = await tailwindHTMLToSceneGraph(
      `<article class="${classes.join(' ')}"><h1>OpenPencil</h1></article>`,
      classes,
      { runtime: engineRuntime() }
    )
    const card = firstLayer(graph)

    expect(card?.type).toBe('FRAME')
    // Tailwind's preflight makes every box border-box, so padding stays inside.
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(176)
    expect(card?.itemSpacing).toBe(12)
  })

  it('projects a parsed and styled HTML/CSS card into a scene graph', async () => {
    const runtime = engineRuntime()
    const document = await runtime.computeStyles(runtime.parseHTML(cardHTML), cssCardCSS)
    const graph = designDocumentToSceneGraph(document)
    const card = expectFrame(firstLayer(graph))

    expect(card.width).toBe(320 + 2 * 24 + 2 * 1)
    expect(card.height).toBe(180 + 2 * 24 + 2 * 1)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
    expect(card.paddingLeft).toBe(24)
    expect(card.fills[0]?.type).toBe('SOLID')
    expect(card.strokes[0]?.weight).toBe(1)
    // A color function in the `border` shorthand, and a shadow color after its lengths.
    expect(card.strokes[0]?.color).toEqual(parseColor(DOM_CSS_COLORS.slate200))
    expect(card.effects[0]?.type).toBe('DROP_SHADOW')
    // A 24px CSS blur is a Gaussian of 12, which the canvas draws at 0.43 × radius.
    expect(card.effects[0]?.radius).toBeCloseTo(12 / 0.43, 6)
    expect(card.effects[0]?.color).toEqual(parseColor(DOM_CSS_COLORS.slateShadow))

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

  it('projects the shared fixture matrix into editable scene graph layers', async () => {
    const graph = await htmlToSceneGraph(fixtureMatrixHTML, {
      cssText: fixtureMatrixCSS,
      runtime: engineRuntime()
    })
    const shell = expectFrame(firstLayer(graph))
    expect(shell.width).toBe(480 + 2 * 32)
    expect(shell.layoutMode).toBe('VERTICAL')
    expect(shell.itemSpacing).toBe(24)
    expect(shell.paddingLeft).toBe(32)

    const [navbarNode, dialogNode] = graph.getChildren(shell.id)
    const navbar = expectFrame(navbarNode)
    const dialog = expectFrame(dialogNode)

    expect(navbar.layoutMode).toBe('HORIZONTAL')
    expect(navbar.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(navbar.counterAxisAlign).toBe('CENTER')
    expect(navbar.cornerRadius).toBe(12)

    const navActions = expectFrame(graph.getChildren(navbar.id)[1])
    const badge = expectFrame(graph.getChildren(navActions.id)[1])
    expect(badge.layoutMode).toBe('HORIZONTAL')
    expect(badge.counterAxisAlign).toBe('CENTER')
    expect(badge.cornerRadius).toBe(9999)
    expect(graph.getChildren(badge.id)[0]?.type).toBe('TEXT')

    expect(dialog.width).toBe(360 + 2 * 24 + 2 * 1)
    expect(dialog.minWidth).toBe(320 + 2 * 24 + 2 * 1)
    expect(dialog.maxWidth).toBe(420 + 2 * 24 + 2 * 1)
    expect(dialog.itemSpacing).toBe(16)
    expect(dialog.effects[0]?.type).toBe('DROP_SHADOW')
    expect(dialog.effects[0]?.radius).toBeCloseTo(20 / 0.43, 6)

    const [, , inputNode, buttonNode] = graph.getChildren(dialog.id)
    const input = expectFrame(inputNode)
    const button = expectFrame(buttonNode)
    expect(input.width).toBe(312 + 2 * 12 + 2 * 1)
    expect(input.height).toBe(40 + 2 * 1)
    expect(input.cornerRadius).toBe(8)
    expect(button.layoutMode).toBe('HORIZONTAL')
    expect(button.primaryAxisAlign).toBe('CENTER')
    expect(button.counterAxisAlign).toBe('CENTER')
    expect(graph.getChildren(button.id)[0]?.type).toBe('TEXT')
  })

  it('projects Tailwind input, badge, and nav fixtures through generated CSS', async () => {
    const runtime = engineRuntime()
    const inputClasses = [...tailwindTextInputClasses]
    const badgeClasses = [...tailwindBadgeClasses]
    const navClasses = [...tailwindNavClasses]
    const classes = [...inputClasses, ...badgeClasses, ...navClasses]
    const document = await runtime.computeStyles(
      runtime.parseHTML(`
        <nav class="${navClasses.join(' ')}">
          <span>OpenPencil</span>
          <span class="${badgeClasses.join(' ')}">Beta</span>
        </nav>
        <input class="${inputClasses.join(' ')}" value="https://openpencil.dev" />
      `),
      await compileTailwindCSS(classes)
    )
    const graph = designDocumentToSceneGraph(document)
    const page = graph.getPages()[0]
    const [nav, input] = page ? graph.getChildren(page.id) : []

    expect(nav?.type).toBe('FRAME')
    expect(input?.type).toBe('FRAME')
    if (nav?.type !== 'FRAME' || input?.type !== 'FRAME') return
    expect(nav.width).toBe(384)
    expect(nav.height).toBe(48)
    expect(nav.layoutMode).toBe('HORIZONTAL')
    expect(nav.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(nav.counterAxisAlign).toBe('CENTER')
    expect(nav.cornerRadius).toBe(12)

    const badge = graph.getChildren(nav.id)[1]
    expect(badge?.type).toBe('FRAME')
    if (badge?.type !== 'FRAME') return
    expect(badge.height).toBe(24)
    expect(badge.layoutMode).toBe('HORIZONTAL')
    expect(badge.primaryAxisAlign).toBe('CENTER')
    expect(badge.counterAxisAlign).toBe('CENTER')

    expect(input.width).toBe(320)
    expect(input.height).toBe(40)
    expect(input.paddingLeft).toBe(12)
    expect(input.cornerRadius).toBe(6)
    expect(input.strokes[0]?.weight).toBe(1)
  })

  it('projects a Tailwind card through generated CSS into a scene graph', async () => {
    const runtime = engineRuntime()
    const classes = [...tailwindCardClasses]
    const document = await runtime.computeStyles(
      runtime.parseHTML(`<article class="${classes.join(' ')}"><h1>OpenPencil</h1></article>`),
      await compileTailwindCSS(classes)
    )
    const graph = designDocumentToSceneGraph(document)
    const card = expectFrame(firstLayer(graph))

    expect(card.width).toBe(320)
    expect(card.height).toBe(176)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
    expect(card.paddingTop).toBe(24)
    expect(card.cornerRadius).toBe(12)
    expect(card.fills[0]?.type).toBe('SOLID')
  })
})
