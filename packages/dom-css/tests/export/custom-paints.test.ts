import { describe, expect, test } from 'bun:test'

import { serializeHTML } from '#dom-css/export/html'
import { sceneNodeToDesignDocument } from '#dom-css/export/projection'
import { sceneNodesToTailwindJSX } from '#dom-css/export/tailwind-jsx'

import { SceneGraph, type Fill, type SceneNode, type Stroke } from '@open-pencil/scene-graph'

import { BLUE_500, designSystem } from './token-fixtures'

const SHADER: Fill = {
  type: 'CUSTOM',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  customEffectAssetRef: { key: 'abc', version: 'v1' }
}
const SHADER_STROKE: Stroke = { ...SHADER, weight: 3, align: 'INSIDE' }
const RED: Fill = { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
const BLUE: Fill = { ...RED, color: { r: 0, g: 0, b: 1, a: 1 } }

function exported(type: SceneNode['type'], layer: Partial<SceneNode>) {
  const graph = new SceneGraph()
  const node = graph.createNode(type, graph.getPages()[0].id, { width: 40, height: 40, ...layer })
  return {
    html: serializeHTML(sceneNodeToDesignDocument(graph, node.id, { includeSourceIds: false })),
    tailwind: sceneNodesToTailwindJSX(graph, [node.id])
  }
}

describe('Figma shader paints in HTML and Tailwind', () => {
  test('a shader stroke writes no border', () => {
    const { html, tailwind } = exported('RECTANGLE', { fills: [RED], strokes: [SHADER_STROKE] })
    expect(html).not.toContain('border')
    expect(tailwind).not.toContain('border')
  })

  test('a stroke after a shader stroke writes the border', () => {
    const solid: Stroke = { ...RED, weight: 2, align: 'INSIDE' }
    const { html, tailwind } = exported('RECTANGLE', { strokes: [SHADER_STROKE, solid] })
    expect(exported('RECTANGLE', { strokes: [solid] })).toEqual({ html, tailwind })
  })

  test("a border's colour binding is the one on its first drawn stroke", () => {
    const border = (boundVariables: Record<string, string>) => {
      const graph = designSystem()
      const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
        width: 40,
        height: 40,
        strokes: [SHADER_STROKE, { ...RED, color: BLUE_500, weight: 2, align: 'INSIDE' }],
        boundVariables
      })
      return JSON.stringify(sceneNodeToDesignDocument(graph, node.id, {}).children[0])
    }
    expect(border({ 'strokes/1/color': 'primary' })).toContain('var(--color-primary)')
    expect(border({ 'strokes/0/color': 'primary' })).not.toContain('var(--color-primary)')
  })

  test('a text takes its colour from its first drawn fill', () => {
    const { html, tailwind } = exported('TEXT', { text: 'Hi', fills: [SHADER, RED] })
    expect(html).toContain('color: #FF0000')
    expect(tailwind).toContain('text-[#FF0000]')
  })
  test('a text whose only visible fill is a shader writes transparent glyphs', () => {
    const { html, tailwind } = exported('TEXT', { text: 'Hi', fills: [SHADER] })
    expect(html).toContain('color: transparent')
    expect(tailwind).toContain('text-transparent')
  })

  test('a text run takes its colour from its first drawn fill', () => {
    const run = (fills: Fill[]) =>
      exported('TEXT', {
        text: 'Hi there',
        fills: [RED],
        styleRuns: [{ start: 3, length: 5, style: { fills } }]
      })
    expect(run([SHADER, BLUE])).toEqual(run([BLUE]))
    expect(run([SHADER]).html).toContain('<span style="color: transparent">there</span>')
  })

  test('a text run CSS cannot colour stays visible in a text that shows only shaders', () => {
    const gradient: Fill = {
      ...BLUE,
      type: 'GRADIENT_LINEAR',
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      gradientStops: [
        { position: 0, color: RED.color },
        { position: 1, color: BLUE.color }
      ]
    }
    const { html } = exported('TEXT', {
      text: 'Hi there',
      fills: [SHADER],
      styleRuns: [{ start: 3, length: 5, style: { fills: [gradient] } }]
    })
    expect(html).toContain('<span style="color: #000000">there</span>')
  })

  test("a text's colour binding is the one on its first drawn fill", () => {
    const colour = (boundVariables: Record<string, string>) => {
      const graph = designSystem()
      const node = graph.createNode('TEXT', graph.getPages()[0].id, {
        text: 'Hi',
        width: 40,
        height: 20,
        fills: [SHADER, { ...RED, color: BLUE_500 }],
        boundVariables
      })
      return sceneNodeToDesignDocument(graph, node.id, {}).children[0]
    }
    expect(colour({ 'fills/1/color': 'primary' })).toMatchObject({
      inlineStyle: { color: 'var(--color-primary)' }
    })
    expect(colour({ 'fills/0/color': 'primary' })).not.toMatchObject({
      inlineStyle: { color: 'var(--color-primary)' }
    })
  })
})
