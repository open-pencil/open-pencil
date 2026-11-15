import { describe, expect, it } from 'bun:test'

import { browserHTMLToSceneGraph } from '#dom-css/browser'
import { sceneGraphToDesignDocument } from '#dom-css/export/projection'
import { designDocumentToSceneGraph } from '#dom-css/import/scene-graph'
import type { DesignElement, DesignNode } from '#dom-css/index'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'
import { DOM_CSS_COLORS, expectFrame } from '@open-pencil/test-support/dom-css'

const TRANSPARENT_PIXEL_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function expectText(node: SceneNode | undefined) {
  expect(node?.type).toBe('TEXT')
  if (node?.type !== 'TEXT') throw new Error('Expected text node')
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
          'border-style': 'dashed',
          'border-top-width': '0px',
          'border-right-width': '2px',
          'border-bottom-width': '0px',
          'border-left-width': '4px',
          opacity: '0.75',
          'box-shadow': `0px 8px 24px 0px ${DOM_CSS_COLORS.dialogShadow}, 0 0 2px ${DOM_CSS_COLORS.slate200}`
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
              'text-transform': 'uppercase',
              'white-space': 'nowrap',
              opacity: '0.5',
              'text-shadow': `0px 1px 2px 0px ${DOM_CSS_COLORS.dialogShadow}`
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
  expect(panel.paddingBottom).toBe(8)
  expect(panel.paddingLeft).toBe(12)
  expect(panel.borderTopWeight).toBe(0)
  expect(panel.borderRightWeight).toBe(2)
  expect(panel.borderBottomWeight).toBe(0)
  expect(panel.borderLeftWeight).toBe(4)
  expect(panel.dashPattern).toEqual([12, 8])
  expect(panel.opacity).toBe(0.75)
  expect(panel.effects[0]?.type).toBe('DROP_SHADOW')
  return panel
}

function expectStyleRoundTripText(graph: SceneGraph, panel: SceneNode) {
  const heading = expectText(graph.getChildren(panel.id)[0])
  expect(heading.fontSize).toBe(18)
  expect(heading.fontWeight).toBe(700)
  expect(heading.lineHeight).toEqual(pixelLength(24))
  expect(heading.letterSpacing).toEqual(pixelLength(0.2))
  expect(heading.textAlignHorizontal).toBe('CENTER')
  expect(heading.textCase).toBe('UPPER')
  expect(heading.maxLines).toBe(1)
  expect(heading.opacity).toBe(0.5)
  expect(heading.effects[0]?.type).toBe('DROP_SHADOW')
}

function expectRoundTripPanelStyle(element: DesignElement) {
  expect(element.inlineStyle?.['padding-block']).toBe('8px')
  expect(element.inlineStyle?.['padding-inline']).toBe('12px')
  expect(element.inlineStyle?.['border-style']).toBe('dashed')
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
  expect(element.inlineStyle?.['text-transform']).toBe('uppercase')
  expect(element.inlineStyle?.['white-space']).toBe('nowrap')
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
  it('rejects pre-aborted browser conversion before runtime work', async () => {
    const abort = new AbortController()
    abort.abort()

    await expect(
      browserHTMLToSceneGraph('<main>Cancelled</main>', { signal: abort.signal })
    ).rejects.toHaveProperty('name', 'AbortError')
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

  it('preserves external image URLs without fetching bytes', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'img',
          attrs: { src: 'https://example.com/hero.png' },
          computedStyle: { width: '320px', height: '180px', 'object-fit': 'cover' },
          children: []
        }
      ]
    })
    const page = graph.getPages()[0]
    const image = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)

    expect(image.fills[0]).toBeUndefined()
    expect(image.pluginData).toContainEqual({
      pluginId: 'open-pencil-dom-css',
      key: 'image-source-url',
      value: 'https://example.com/hero.png'
    })
    expect(graph.images.size).toBe(0)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') throw new Error('Expected root element')
    const roundTripImage = root.children[0]
    expect(roundTripImage?.type).toBe('element')
    if (roundTripImage?.type !== 'element') throw new Error('Expected image element')
    expect(roundTripImage.tagName).toBe('img')
    expect(roundTripImage.attrs.src).toBe('https://example.com/hero.png')
  })

  it('keeps an SVG data URL as the source rather than an image fill', () => {
    for (const src of [
      'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E',
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4='
    ]) {
      const graph = designDocumentToSceneGraph({
        type: 'document',
        children: [
          {
            type: 'element',
            tagName: 'img',
            attrs: { src },
            computedStyle: { width: '32px', height: '32px' },
            children: []
          }
        ]
      })
      const page = graph.getPages()[0]
      const image = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)
      expect(image.fills[0]).toBeUndefined()
      expect(image.pluginData).toContainEqual({
        pluginId: 'open-pencil-dom-css',
        key: 'image-source-url',
        value: src
      })
      expect(graph.images.size).toBe(0)
    }
  })

  it('maps data URL images, object fit, and aspect ratio', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'img',
          attrs: { src: TRANSPARENT_PIXEL_DATA_URL },
          computedStyle: {
            'aspect-ratio': '16 / 9',
            width: '320px',
            'object-fit': 'contain'
          },
          children: []
        }
      ]
    })
    const page = graph.getPages()[0]
    const image = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)
    const fill = image.fills[0]

    expect(image.width).toBe(320)
    expect(image.height).toBe(180)
    expect(fill?.type).toBe('IMAGE')
    expect(fill?.imageScaleMode).toBe('FIT')
    expect(fill?.imageHash).toBeDefined()
    expect(fill?.imageHash ? graph.images.has(fill.imageHash) : false).toBe(true)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') throw new Error('Expected root element')
    const roundTripImage = root.children[0]
    expect(roundTripImage?.type).toBe('element')
    if (roundTripImage?.type !== 'element') throw new Error('Expected image element')
    expect(roundTripImage.tagName).toBe('img')
    expect(roundTripImage.inlineStyle?.['aspect-ratio']).toBe('320 / 180')
    expect(roundTripImage.inlineStyle?.['object-fit']).toBe('contain')
    expect(roundTripImage.attrs.src).toStartWith('data:image/png;base64,')
  })

  it('round-trips logical padding, side borders, opacity, and text style fields', () => {
    const graph = createStyleRoundTripGraph()
    const panel = expectStyleRoundTripPanel(graph)
    expectStyleRoundTripText(graph, panel)
    expectStyleRoundTripHTML(graph)
  })

  it('maps flex row and column gaps by axis', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'column-wrap' },
          computedStyle: {
            display: 'flex',
            'flex-direction': 'column',
            'flex-wrap': 'wrap',
            'row-gap': '14px',
            'column-gap': '24px'
          },
          children: []
        }
      ]
    })
    const page = graph.getPages()[0]
    const stack = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)

    expect(stack.layoutMode).toBe('VERTICAL')
    expect(stack.layoutWrap).toBe('WRAP')
    expect(stack.itemSpacing).toBe(14)
    expect(stack.counterAxisSpacing).toBe(24)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') return
    const roundTripStack = root.children[0]
    expect(roundTripStack?.type).toBe('element')
    if (roundTripStack?.type !== 'element') return
    expect(roundTripStack.inlineStyle?.['row-gap']).toBe('14px')
    expect(roundTripStack.inlineStyle?.['column-gap']).toBe('24px')
  })

  it('maps flex wrapping, align-self, clipping, and absolute positioning', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'wrap' },
          computedStyle: {
            display: 'flex',
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
              attrs: { class: 'absolute' },
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
    const wrap = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)
    const absolute = expectFrame(graph.getChildren(wrap.id)[0])

    expect(wrap.layoutWrap).toBe('WRAP')
    expect(wrap.counterAxisSpacing).toBe(20)
    expect(wrap.clipsContent).toBe(true)
    expect(absolute.layoutPositioning).toBe('ABSOLUTE')
    expect(absolute.layoutAlignSelf).toBe('CENTER')
    expect(absolute.x).toBe(16)
    expect(absolute.y).toBe(24)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') return
    const roundTripWrap = root.children[0]
    expect(roundTripWrap?.type).toBe('element')
    if (roundTripWrap?.type !== 'element') return
    expect(roundTripWrap.inlineStyle?.['flex-wrap']).toBe('wrap')
    expect(roundTripWrap.inlineStyle?.['row-gap']).toBe('20px')

    const roundTripAbsolute = roundTripWrap.children[0]
    expect(roundTripAbsolute?.type).toBe('element')
    if (roundTripAbsolute?.type !== 'element') return
    expect(roundTripAbsolute.inlineStyle?.position).toBe('absolute')
    expect(roundTripAbsolute.inlineStyle?.left).toBe('16px')
    expect(roundTripAbsolute.inlineStyle?.top).toBe('24px')
    expect(roundTripAbsolute.inlineStyle?.['align-self']).toBe('center')
  })
})
