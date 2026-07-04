import { describe, expect, it } from 'bun:test'

import type { DesignElement, DesignNode } from '@open-pencil/dom-css'
import {
  compileTailwindCSS,
  createHeadlessCSSRuntime,
  designDocumentToSceneGraph,
  htmlToDesignDocument,
  htmlToSceneGraph,
  sceneGraphToDesignDocument,
  serializeHTML,
  tailwindHTMLToSceneGraph
} from '@open-pencil/dom-css'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import {
  DOM_CSS_COLORS,
  computedCardDocument,
  cssCardCSS,
  cssCardHTML,
  fixtureMatrixCSS,
  fixtureMatrixHTML,
  tailwindBadgeClasses,
  tailwindCardClasses,
  tailwindInputClasses,
  tailwindNavClasses
} from '#tests/helpers/dom-css'

function expectFrame(node: SceneNode | undefined) {
  expect(node?.type).toBe('FRAME')
  if (node?.type !== 'FRAME') throw new Error('Expected frame node')
  return node
}

function findTextElement(nodes: DesignNode[]): DesignElement | undefined {
  for (const node of nodes) {
    if (node.type !== 'element') continue
    if (node.children.some((child) => child.type === 'text')) return node
    const child = findTextElement(node.children)
    if (child) return child
  }
  return undefined
}

function createStyleRoundTripGraph() {
  return designDocumentToSceneGraph({
    type: 'document',
    children: [
      {
        type: 'element',
        tagName: 'section',
        attrs: { class: 'panel' },
        computedStyle: {
          display: 'flex',
          'flex-direction': 'column',
          width: '240px',
          height: '120px',
          'padding-block': '8px',
          'padding-inline': '12px',
          'border-color': DOM_CSS_COLORS.slate200,
          'border-top-width': '0px',
          'border-right-width': '2px',
          'border-bottom-width': '0px',
          'border-left-width': '4px',
          opacity: '0.75',
          'box-shadow': `0px 8px 24px 0px ${DOM_CSS_COLORS.slateShadow}`
        },
        children: [
          {
            type: 'element',
            tagName: 'h1',
            attrs: {},
            computedStyle: {
              color: DOM_CSS_COLORS.slate950,
              'font-family': 'Inter, sans-serif',
              'font-size': '18px',
              'font-weight': '700',
              'line-height': '24px',
              'letter-spacing': '0.2px',
              'text-align': 'center',
              opacity: '0.5',
              'text-shadow': `0px 1px 2px 0px ${DOM_CSS_COLORS.slateShadow}`
            },
            children: [{ type: 'text', text: 'Round trip' }]
          }
        ]
      }
    ]
  })
}

function expectStyleRoundTripPanel(graph: SceneGraph) {
  const page = graph.getPages()[0]
  const panel = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)
  expect(panel.paddingTop).toBe(8)
  expect(panel.paddingRight).toBe(12)
  expect(panel.borderTopWeight).toBe(0)
  expect(panel.borderRightWeight).toBe(2)
  expect(panel.borderLeftWeight).toBe(4)
  expect(panel.opacity).toBe(0.75)
  expect(panel.effects[0]?.type).toBe('DROP_SHADOW')
  return panel
}

function expectStyleRoundTripText(graph: SceneGraph, panel: SceneNode) {
  const heading = graph.getChildren(panel.id)[0]
  expect(heading?.type).toBe('TEXT')
  if (heading?.type !== 'TEXT') throw new Error('Expected text node')
  expect(heading.fontSize).toBe(18)
  expect(heading.fontWeight).toBe(700)
  expect(heading.lineHeight).toBe(24)
  expect(heading.letterSpacing).toBe(0.2)
  expect(heading.textAlignHorizontal).toBe('CENTER')
  expect(heading.opacity).toBe(0.5)
  expect(heading.effects[0]?.type).toBe('DROP_SHADOW')
}

function expectRoundTripPanelStyle(element: DesignElement) {
  expect(element.inlineStyle?.['padding-block']).toBe('8px')
  expect(element.inlineStyle?.['padding-inline']).toBe('12px')
  expect(element.inlineStyle?.['border-top-width']).toBe('0px')
  expect(element.inlineStyle?.['border-left-width']).toBe('4px')
  expect(element.inlineStyle?.opacity).toBe('0.75')
  expect(element.inlineStyle?.['box-shadow']).toContain('24px')
}

function expectRoundTripHeadingStyle(element: DesignElement) {
  expect(element.inlineStyle?.['font-size']).toBe('18px')
  expect(element.inlineStyle?.['font-weight']).toBe('700')
  expect(element.inlineStyle?.['line-height']).toBe('24px')
  expect(element.inlineStyle?.['letter-spacing']).toBe('0.2px')
  expect(element.inlineStyle?.['text-align']).toBe('center')
  expect(element.inlineStyle?.opacity).toBe('0.5')
  expect(element.inlineStyle?.['text-shadow']).toContain('2px')
}

function expectStyleRoundTripHTML(graph: SceneGraph) {
  const roundTrip = sceneGraphToDesignDocument(graph)
  const root = roundTrip.children[0]
  expect(root?.type).toBe('element')
  if (root?.type !== 'element') throw new Error('Expected root element')
  const roundTripPanel = root.children[0]
  expect(roundTripPanel?.type).toBe('element')
  if (roundTripPanel?.type !== 'element') throw new Error('Expected panel element')
  expectRoundTripPanelStyle(roundTripPanel)

  const roundTripHeading = roundTripPanel.children[0]
  expect(roundTripHeading?.type).toBe('element')
  if (roundTripHeading?.type !== 'element') throw new Error('Expected heading element')
  expectRoundTripHeadingStyle(roundTripHeading)
}

describe('@open-pencil/dom-css conversion', () => {
  it('converts HTML and CSS to DesignDOM with one API call', async () => {
    const document = await htmlToDesignDocument(cssCardHTML, {
      cssText: cssCardCSS,
      runtime: createHeadlessCSSRuntime()
    })
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.computedStyle?.width).toBe('320px')
    expect(card.computedStyle?.['border-radius']).toBe('16px')
  })

  it('converts HTML and CSS to a scene graph with one API call', async () => {
    const graph = await htmlToSceneGraph(cssCardHTML, {
      cssText: cssCardCSS,
      runtime: createHeadlessCSSRuntime()
    })
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.layoutMode).toBe('VERTICAL')
  })

  it('converts Tailwind HTML through generated CSS to a scene graph', async () => {
    const classes = [...tailwindCardClasses]
    const graph = await tailwindHTMLToSceneGraph(
      `<article class="${classes.join(' ')}"><h1>OpenPencil</h1></article>`,
      classes,
      { runtime: createHeadlessCSSRuntime() }
    )
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(176)
    expect(card?.itemSpacing).toBe(12)
  })

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

  it('maps CSS shape constraints, clipping, corners, and borders', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'panel' },
          computedStyle: {
            width: '320px',
            height: '160px',
            'min-width': '240px',
            'max-width': '480px',
            'min-height': '120px',
            'max-height': '320px',
            overflow: 'hidden',
            'border-top-color': 'rgb(229, 231, 235)',
            'border-top-width': '1px',
            'border-right-width': '2px',
            'border-bottom-width': '3px',
            'border-left-width': '4px',
            'border-top-left-radius': '4px',
            'border-top-right-radius': '8px',
            'border-bottom-right-radius': '12px',
            'border-bottom-left-radius': '16px'
          },
          children: []
        }
      ]
    })
    const page = graph.getPages()[0]
    const panel = page ? graph.getChildren(page.id)[0] : undefined

    expect(panel?.type).toBe('FRAME')
    if (panel?.type !== 'FRAME') return
    expect(panel.minWidth).toBe(240)
    expect(panel.maxWidth).toBe(480)
    expect(panel.minHeight).toBe(120)
    expect(panel.maxHeight).toBe(320)
    expect(panel.clipsContent).toBe(true)
    expect(panel.independentStrokeWeights).toBe(true)
    expect(panel.borderTopWeight).toBe(1)
    expect(panel.borderRightWeight).toBe(2)
    expect(panel.borderBottomWeight).toBe(3)
    expect(panel.borderLeftWeight).toBe(4)
    expect(panel.independentCorners).toBe(true)
    expect(panel.topLeftRadius).toBe(4)
    expect(panel.topRightRadius).toBe(8)
    expect(panel.bottomRightRadius).toBe(12)
    expect(panel.bottomLeftRadius).toBe(16)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') return
    const roundTripPanel = root.children[0]
    expect(roundTripPanel?.type).toBe('element')
    if (roundTripPanel?.type !== 'element') return
    expect(roundTripPanel.inlineStyle?.overflow).toBe('hidden')
    expect(roundTripPanel.inlineStyle?.['min-width']).toBe('240px')
    expect(roundTripPanel.inlineStyle?.['border-top-width']).toBe('1px')
    expect(roundTripPanel.inlineStyle?.['border-left-width']).toBe('4px')
    expect(roundTripPanel.inlineStyle?.['border-bottom-left-radius']).toBe('16px')
  })

  it('round-trips logical padding, opacity, and text shadows', () => {
    const graph = createStyleRoundTripGraph()
    const panel = expectStyleRoundTripPanel(graph)
    expectStyleRoundTripText(graph, panel)
    expectStyleRoundTripHTML(graph)
  })

  it('maps CSS flex wrapping, self alignment, clipping, and absolute position', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'stack' },
          computedStyle: {
            display: 'flex',
            'flex-direction': 'row',
            'flex-wrap': 'wrap',
            gap: '12px',
            'row-gap': '20px',
            overflow: 'clip',
            width: '240px',
            height: '120px'
          },
          children: [
            {
              type: 'element',
              tagName: 'div',
              attrs: { class: 'chip' },
              computedStyle: {
                position: 'absolute',
                left: '16px',
                top: '24px',
                'align-self': 'center',
                width: '80px',
                height: '32px'
              },
              children: []
            }
          ]
        }
      ]
    })
    const page = graph.getPages()[0]
    const stack = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)
    const chip = expectFrame(graph.getChildren(stack.id)[0])

    expect(stack.layoutMode).toBe('HORIZONTAL')
    expect(stack.layoutWrap).toBe('WRAP')
    expect(stack.itemSpacing).toBe(12)
    expect(stack.counterAxisSpacing).toBe(20)
    expect(stack.clipsContent).toBe(true)
    expect(chip.layoutPositioning).toBe('ABSOLUTE')
    expect(chip.layoutAlignSelf).toBe('CENTER')
    expect(chip.x).toBe(16)
    expect(chip.y).toBe(24)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') return
    const roundTripStack = root.children[0]
    expect(roundTripStack?.type).toBe('element')
    if (roundTripStack?.type !== 'element') return
    expect(roundTripStack.inlineStyle?.['flex-wrap']).toBe('wrap')
    expect(roundTripStack.inlineStyle?.['row-gap']).toBe('20px')
    expect(roundTripStack.inlineStyle?.overflow).toBe('hidden')

    const roundTripChip = roundTripStack.children[0]
    expect(roundTripChip?.type).toBe('element')
    if (roundTripChip?.type !== 'element') return
    expect(roundTripChip.inlineStyle?.position).toBe('absolute')
    expect(roundTripChip.inlineStyle?.left).toBe('16px')
    expect(roundTripChip.inlineStyle?.top).toBe('24px')
    expect(roundTripChip.inlineStyle?.['align-self']).toBe('center')
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
