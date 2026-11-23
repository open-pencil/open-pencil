import { describe, expect, it } from 'bun:test'

import { sceneNodeToDesignDocument } from '@open-pencil/dom-css/export'
import { SceneGraph, type ColorProfile } from '@open-pencil/scene-graph'

/** The CSS a box with a solid fill, a gradient stroke, and a shadow projects to. */
function style(profile: ColorProfile) {
  const graph = new SceneGraph()
  graph.documentColorSpace = profile
  const page = graph.getPages()[0]
  const red = { r: 1, g: 0, b: 0, a: 1 }
  const box = graph.createNode('FRAME', page.id, {
    name: 'Box',
    width: 100,
    height: 50,
    fills: [
      { type: 'SOLID', color: red, opacity: 1, visible: true },
      {
        type: 'GRADIENT_LINEAR',
        color: red,
        opacity: 1,
        visible: true,
        gradientStops: [
          { color: red, position: 0 },
          { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
        ],
        gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ],
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 1, b: 0, a: 0.5 },
        offset: { x: 0, y: 2 },
        radius: 4,
        spread: 0,
        visible: true
      }
    ]
  })
  return sceneNodeToDesignDocument(graph, box.id).children[0]
}

describe('CSS of a document in a color profile', () => {
  it('writes a Display P3 document’s colors as P3, blending its gradients in P3', () => {
    const node = style('display-p3')
    const css = node.type === 'element' ? node.inlineStyle : undefined
    expect(css?.['background-color']).toBe('color(display-p3 1 0 0)')
    expect(css?.['background-image']).toStartWith('linear-gradient(90deg in display-p3, ')
    expect(css?.['box-shadow']).toContain('color(display-p3 0 1 0 / 0.5)')
  })

  it('keeps writing an sRGB document’s colors as hex', () => {
    const node = style('srgb')
    const css = node.type === 'element' ? node.inlineStyle : undefined
    expect(css?.['background-color']).toBe('#FF0000')
    expect(css?.['background-image']).toStartWith('linear-gradient(90deg, ')
  })
})
