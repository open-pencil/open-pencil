import { describe, expect, test } from 'bun:test'

import { createDesignJSXRenderer } from '#design-jsx/index'

import { SceneGraph, type ColorProfile } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

const renderer = createDesignJSXRenderer<never>({
  icon: () => Promise.resolve(null),
  svg: () => null,
  createArtwork: () => {
    throw new Error('No artwork in these tests')
  },
  layout: () => {
    // Colors do not depend on layout.
  },
  vectorBounds: () => {
    throw new Error('No vectors in these tests')
  }
})

const P3_RED = 'color(display-p3 1 0 0)'

/** The colors a frame and its text take from props written as `P3_RED`. */
async function rendered(profile: ColorProfile) {
  const graph = new SceneGraph()
  graph.documentColorSpace = profile
  const [result] = await renderer.renderJSX(
    graph,
    `<Frame bg="${P3_RED}" stroke="${P3_RED}" shadow="0 2px 4px ${P3_RED}"><Text color="${P3_RED}">Hi</Text></Frame>`
  )
  const frame = graph.getNode(result.id)
  const text = graph.getNode(frame?.childIds[0] ?? '')
  return {
    bg: frame?.fills[0]?.color,
    stroke: frame?.strokes[0]?.color,
    shadow: frame?.effects[0]?.color,
    text: text?.fills[0]?.color
  }
}

function expectComponents(color: Color | undefined, r: number, g: number, b: number) {
  expect(color?.r).toBeCloseTo(r, 4)
  expect(color?.g).toBeCloseTo(g, 4)
  expect(color?.b).toBeCloseTo(b, 4)
}

describe('direct color props in a color profile', () => {
  test('a Display P3 document stores P3 colors as their own components', async () => {
    const colors = await rendered('display-p3')
    for (const color of Object.values(colors)) expectComponents(color, 1, 0, 0)
  })

  test('an sRGB document brings them inside sRGB', async () => {
    const colors = await rendered('srgb')
    for (const color of Object.values(colors)) {
      expect(color?.r).toBeCloseTo(1, 1)
      expect(color?.g ?? 1).toBeLessThan(0.2)
    }
  })
})
