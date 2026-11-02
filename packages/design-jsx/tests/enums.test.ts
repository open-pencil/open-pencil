import { describe, expect, test } from 'bun:test'

import {
  BLEND_MODE,
  CONSTRAINT,
  MASK_TYPE,
  FIGJAM_TEXT_SIZE,
  STROKE_ALIGN,
  STROKE_CAP,
  STROKE_JOIN,
  TEXT_ALIGN,
  TEXT_ALIGN_VERTICAL,
  TEXT_AUTO_RESIZE,
  TEXT_CASE,
  TEXT_DECORATION,
  TEXT_DECORATION_STYLE,
  TEXT_DIRECTION,
  type JSXEnum
} from '#design-jsx/enums'
import { createDesignJSXRenderer, sceneNodeToJSX } from '#design-jsx/index'

import { SceneGraph, type StrokeCap } from '@open-pencil/scene-graph'

const renderer = createDesignJSXRenderer<never>({
  icon: () => Promise.resolve(null),
  svg: () => null,
  createArtwork: () => {
    throw new Error('No artwork in these tests')
  },
  layout: () => {
    // These props do not depend on layout.
  },
  vectorBounds: () => {
    throw new Error('No vectors in these tests')
  }
})

async function render(source: string) {
  const graph = new SceneGraph()
  const [result] = await renderer.renderJSX(graph, source)
  const node = graph.getNode(result.id)
  if (!node) throw new Error('Rendered layer is missing')
  return { graph, node, warnings: result.warnings ?? [] }
}

const ENUMS: Record<string, JSXEnum<string>> = {
  BLEND_MODE,
  CONSTRAINT,
  MASK_TYPE,
  STROKE_ALIGN,
  STROKE_CAP,
  STROKE_JOIN,
  TEXT_ALIGN,
  TEXT_ALIGN_VERTICAL,
  TEXT_AUTO_RESIZE,
  TEXT_CASE,
  TEXT_DECORATION,
  TEXT_DECORATION_STYLE,
  TEXT_DIRECTION
}

describe('design JSX enums', () => {
  test.each(Object.entries(ENUMS))('%s reads back every spelling it writes', (_, values) => {
    for (const name of values.names) {
      const value = values.parse(name)
      expect(value).toBeDefined()
      if (value) expect(values.parse(values.print(value))).toBe(value)
    }
  })

  test('spellings read case-insensitively and unknown ones read as nothing', () => {
    expect(TEXT_ALIGN.parse('Center')).toBe('CENTER')
    expect(TEXT_ALIGN.parse('left_align')).toBe('LEFT')
    expect(TEXT_AUTO_RESIZE.parse('width')).toBe('WIDTH_AND_HEIGHT')
    expect(BLEND_MODE.parse('sparkle')).toBeUndefined()
    expect(BLEND_MODE.parse(3)).toBeUndefined()
  })

  const caps: StrokeCap[] = [
    'ROUND',
    'SQUARE',
    'ARROW_LINES',
    'ARROW_EQUILATERAL',
    'TRIANGLE_FILLED',
    'DIAMOND_FILLED',
    'CIRCLE_FILLED'
  ]

  test.each(caps)('a %s stroke cap survives export and render', async (cap) => {
    const graph = new SceneGraph()
    const page = graph.createNode('CANVAS', graph.rootId, { name: 'Page 1' })
    const line = graph.createNode('LINE', page.id, { width: 100, strokeCap: cap })
    const { node, warnings } = await render(sceneNodeToJSX(line.id, graph))
    expect(warnings).toEqual([])
    expect(node.strokeCap).toBe(cap)
  })

  test('an unknown value warns and is not applied', async () => {
    const { node, warnings } = await render('<Frame blendMode="sparkle" />')
    expect(node.blendMode).toBe('PASS_THROUGH')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toStartWith('Unknown blendMode "sparkle" on <frame> is ignored; expected ')
  })
  test('an unknown mask type warns and leaves the layer unmasked', async () => {
    const { node, warnings } = await render('<Rectangle mask="sparkle" />')
    expect(node.isMask).toBe(false)
    expect(warnings[0]).toStartWith('Unknown mask "sparkle" on <rectangle> is ignored')
    expect((await render('<Rectangle mask />')).node.maskType).toBe('ALPHA')
  })

  test('a text decoration style reads in any case', async () => {
    const { node, warnings } = await render(
      '<Text textDecoration="underline" textDecorationStyle="WAVY">a</Text>'
    )
    expect(node.textDecorationStyle).toBe('WAVY')
    expect(warnings).toEqual([])
  })

  test('a sticky text size reads as its camelCase name in any case, and an unknown one warns', async () => {
    expect(FIGJAM_TEXT_SIZE.parse('extralarge')).toBe('extraLarge')
    expect(FIGJAM_TEXT_SIZE.print('extraLarge')).toBe('extraLarge')
    const { warnings } = await render('<Sticky textSize="giant">Hi</Sticky>')
    expect(warnings[0]).toStartWith('Unknown textSize "giant" on <sticky> is ignored')
  })

  test('a connector cap is spelled as strokeCap spells it, and an unknown one warns', async () => {
    const { graph, warnings } = await render(
      '<Frame><Rectangle name="A" /><Rectangle name="B" /><Connector from="A" to="B" startCap="circle_filled" endCap="arrow" /></Frame>'
    )
    const connector = [...graph.getAllNodes()].find((node) => node.type === 'CONNECTOR')
    expect(connector?.connectorStartCap).toBe('CIRCLE_FILLED')
    expect(connector?.connectorEndCap).toBe('ARROW_LINES')
    expect(warnings[0]).toStartWith('Unknown endCap "arrow" on <connector> is ignored')
  })
})
