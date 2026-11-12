import { describe, expect, it } from 'bun:test'

import type { DesignElement } from '@open-pencil/dom-css'
import { designDocumentToSceneGraph } from '@open-pencil/dom-css/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'
import { DOM_CSS_COLORS } from '@open-pencil/test-support/dom-css'

import { expectElement, expectFrame, exportedFirstLayer, firstLayer } from './helpers'

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
          'border-style': 'solid',
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
  const panel = expectFrame(firstLayer(graph))
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
  expect(heading.lineHeight).toEqual(pixelLength(24))
  expect(heading.letterSpacing).toEqual(pixelLength(0.2))
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
  const roundTripPanel = exportedFirstLayer(graph)
  expectRoundTripPanelStyle(roundTripPanel)
  expectRoundTripHeadingStyle(expectElement(roundTripPanel.children[0]))
}

describe('@open-pencil/dom-css style round trip', () => {
  it('leaves out a border with widths but no style, as CSS draws none', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'panel' },
          computedStyle: {
            'min-width': '240px',
            'max-width': '480px',
            'border-color': 'rgb(229, 231, 235)',
            'border-width': '4px'
          },
          children: []
        }
      ]
    })
    const panel = expectFrame(firstLayer(graph))

    expect(panel.strokes).toEqual([])
    expect(panel).toMatchObject({ minWidth: 240, maxWidth: 480 })
  })

  it('draws a border on the sides whose style is drawn, as a browser computes them', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'row' },
          // A browser reports every side; only the bottom has a style that draws.
          computedStyle: {
            'border-top-style': 'none',
            'border-right-style': 'none',
            'border-bottom-style': 'solid',
            'border-left-style': 'none',
            'border-top-color': 'rgb(0, 0, 0)',
            'border-right-color': 'rgb(0, 0, 0)',
            'border-bottom-color': 'rgb(255, 0, 0)',
            'border-left-color': 'rgb(0, 0, 0)',
            // Widths on sides that draw nothing, so only their style keeps them out.
            'border-top-width': '3px',
            'border-right-width': '3px',
            'border-bottom-width': '2px',
            'border-left-width': '3px'
          },
          children: []
        }
      ]
    })
    const row = expectFrame(firstLayer(graph))

    expect(row.strokes[0]?.color).toMatchObject({ r: 1, g: 0, b: 0 })
    expect(row).toMatchObject({
      independentStrokeWeights: true,
      borderTopWeight: 0,
      borderRightWeight: 0,
      borderBottomWeight: 2,
      borderLeftWeight: 0
    })
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
            'border-style': 'solid',
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
    const panel = expectFrame(firstLayer(graph))

    // Content-box limits grow by the borders: 4 + 2 across, 1 + 3 down.
    expect(panel).toMatchObject({ minWidth: 246, maxWidth: 486, minHeight: 124, maxHeight: 324 })
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

    const roundTripPanel = exportedFirstLayer(graph)
    expect(roundTripPanel.inlineStyle?.overflow).toBe('hidden')
    // The same 240px content box, written as a border box.
    expect(roundTripPanel.inlineStyle).toMatchObject({
      'min-width': '246px',
      'box-sizing': 'border-box'
    })
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
    const stack = expectFrame(firstLayer(graph))
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

    const roundTripStack = exportedFirstLayer(graph)
    expect(roundTripStack.inlineStyle?.['flex-wrap']).toBe('wrap')
    expect(roundTripStack.inlineStyle?.['row-gap']).toBe('20px')
    expect(roundTripStack.inlineStyle?.overflow).toBe('hidden')

    const roundTripChip = expectElement(roundTripStack.children[0])
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
    const toolbar = expectFrame(firstLayer(graph))

    expect(toolbar.layoutMode).toBe('HORIZONTAL')
    expect(toolbar.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(toolbar.counterAxisAlign).toBe('CENTER')

    const roundTripToolbar = exportedFirstLayer(graph)
    expect(roundTripToolbar.inlineStyle?.['justify-content']).toBe('space-between')
    expect(roundTripToolbar.inlineStyle?.['align-items']).toBe('center')
  })
})
