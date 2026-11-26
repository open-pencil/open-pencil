import { describe, expect, it } from 'bun:test'

import { designDocumentToSceneGraph } from '#dom-css/import/scene-graph'

function textLayer(computedStyle: Record<string, string>) {
  const graph = designDocumentToSceneGraph({
    type: 'document',
    children: [
      {
        type: 'element',
        tagName: 'h1',
        attrs: {},
        computedStyle: { 'font-family': 'Inter', 'font-size': '48px', ...computedStyle },
        children: [{ type: 'text', text: 'Heading' }]
      }
    ]
  })
  return graph.getChildren(graph.getPages()[0].id)[0]
}

describe('variable font axes from CSS', () => {
  it('draws a weight between the hundreds and a width other than normal on their axes', () => {
    const text = textLayer({ 'font-weight': '440', 'font-stretch': '87.5%' })

    expect(text?.fontWeight).toBe(440)
    expect(text?.fontVariations).toEqual([
      { axis: 'wght', value: 440 },
      { axis: 'wdth', value: 87.5 }
    ])
  })

  it('leaves a named weight at normal width to the font’s instance', () => {
    expect(textLayer({ 'font-weight': '600', 'font-stretch': '100%' })?.fontVariations).toEqual([])
  })

  it('sets the optical size from the font size, as CSS does unless told not to', () => {
    expect(textLayer({ 'font-optical-sizing': 'auto' })?.opticalSizeFromFontSize).toBe(true)
    expect(textLayer({ 'font-optical-sizing': 'none' })?.opticalSizeFromFontSize).toBe(false)
  })

  it('keeps a span’s width and optical sizing in its own run', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'p',
          attrs: {},
          computedStyle: { 'font-family': 'Inter', 'font-size': '16px', 'font-weight': '400' },
          children: [
            { type: 'text', text: 'Plain ' },
            {
              type: 'element',
              tagName: 'span',
              attrs: {},
              computedStyle: {
                'font-family': 'Inter',
                'font-size': '16px',
                'font-weight': '400',
                'font-stretch': '87.5%',
                'font-optical-sizing': 'none',
                display: 'inline'
              },
              children: [{ type: 'text', text: 'narrow' }]
            }
          ]
        }
      ]
    })
    const [text] = graph.getChildren(graph.getPages()[0].id)

    expect(text?.styleRuns?.map(({ start, length, style }) => ({ start, length, style }))).toEqual([
      {
        start: 6,
        length: 6,
        style: expect.objectContaining({
          fontVariations: [{ axis: 'wdth', value: 87.5 }],
          opticalSizeFromFontSize: false
        })
      }
    ])
  })
})
