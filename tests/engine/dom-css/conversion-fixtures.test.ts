import { describe, expect, it } from 'bun:test'

import {
  compileTailwindCSS,
  createHeadlessCSSRuntime,
  designDocumentToSceneGraph,
  htmlToSceneGraph,
  sceneGraphToDesignDocument
} from '@open-pencil/dom-css'

import {
  computedCardDocument,
  expectFrame,
  fixtureMatrixCSS,
  fixtureMatrixHTML,
  tailwindBadgeClasses,
  tailwindCardClasses,
  tailwindInputClasses,
  tailwindNavClasses
} from '#tests/helpers/dom-css'

describe('@open-pencil/dom-css conversion fixtures', () => {
  it('projects the shared fixture matrix into editable scene graph layers', async () => {
    const graph = await htmlToSceneGraph(fixtureMatrixHTML, {
      cssText: fixtureMatrixCSS,
      runtime: createHeadlessCSSRuntime()
    })
    const page = graph.getPages()[0]
    const shell = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)
    expect(shell.width).toBe(480)
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

    expect(dialog.width).toBe(360)
    expect(dialog.minWidth).toBe(320)
    expect(dialog.maxWidth).toBe(420)
    expect(dialog.itemSpacing).toBe(16)
    expect(dialog.effects[0]?.type).toBe('DROP_SHADOW')
    expect(dialog.effects[0]?.radius).toBe(40)

    const [, , inputNode, buttonNode] = graph.getChildren(dialog.id)
    const input = expectFrame(inputNode)
    const button = expectFrame(buttonNode)
    expect(input.width).toBe(312)
    expect(input.height).toBe(40)
    expect(input.cornerRadius).toBe(8)
    expect(button.layoutMode).toBe('HORIZONTAL')
    expect(button.primaryAxisAlign).toBe('CENTER')
    expect(button.counterAxisAlign).toBe('CENTER')
    expect(graph.getChildren(button.id)[0]?.type).toBe('TEXT')
  })

  it('projects Tailwind input, badge, and nav fixtures through generated CSS', async () => {
    const runtime = createHeadlessCSSRuntime()
    const inputClasses = [...tailwindInputClasses]
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
