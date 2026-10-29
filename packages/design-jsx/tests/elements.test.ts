import { describe, expect, test } from 'bun:test'

import {
  DESIGN_JSX_ELEMENTS,
  elementPropsByName,
  elementSchema,
  elementTag
} from '#design-jsx/elements'
import { createDesignJSXRenderer } from '#design-jsx/index'
import { elementPropWarnings } from '#design-jsx/schema'

import { SceneGraph } from '@open-pencil/scene-graph'
import { GENERATED_FRAME_TYPES } from '@open-pencil/scene-graph/generated'

const renderer = createDesignJSXRenderer<never>({
  icon: () => Promise.resolve(null),
  svg: () => null,
  createArtwork: () => {
    throw new Error('No artwork in these tests')
  },
  layout: () => {
    // Element types do not depend on layout.
  },
  vectorBounds: () => {
    throw new Error('No vectors in these tests')
  }
})

const LAYER_ELEMENTS = DESIGN_JSX_ELEMENTS.filter((element) => element.nodeType !== undefined)

describe('design JSX elements', () => {
  test.each(LAYER_ELEMENTS.map((element) => [element.name, element.nodeType]))(
    '<%s /> builds a %s',
    async (name, nodeType) => {
      const graph = new SceneGraph()
      const [result] = await renderer.renderJSX(graph, `<${name} />`)
      expect(graph.getNode(result.id)?.type).toBe(nodeType)
      expect(result.warnings ?? []).toEqual([])
    }
  )

  test('every generated frame is written by an element that reads its props by a schema and draws its own layer', () => {
    for (const type of GENERATED_FRAME_TYPES) {
      const element = DESIGN_JSX_ELEMENTS.find((candidate) => candidate.writes?.includes(type))
      expect(element?.schema).toBeDefined()
      expect(element?.ownLayer).toBeDefined()
    }
  })

  test('a prop value JSON cannot write is still reported', () => {
    const schema = elementSchema('sticky')
    expect(schema).toBeDefined()
    if (!schema) return
    expect(elementPropWarnings(schema, { wide: { flag: BigInt(1) } }, 'sticky')).toEqual([
      'Invalid wide {…} on <sticky> is ignored; expected boolean.'
    ])
  })

  test('every layer type an element writes is written by that element', () => {
    for (const element of DESIGN_JSX_ELEMENTS) {
      for (const type of element.writes ?? []) expect(elementTag(type)).toBe(element.name)
    }
  })

  test("an editor checks each element's own props, as the renderer does", () => {
    expect(elementPropsByName('Connector')?.has('from')).toBe(true)
    expect(elementPropsByName('Shape')?.has('kind')).toBe(true)
    expect(elementPropsByName('Sticky')?.has('author')).toBe(true)
    expect(elementPropsByName('Frame')?.has('from')).toBe(false)
    expect(elementPropsByName('div')?.has('bg')).toBe(true)
    // An instance also sets its component's properties, and a local component is no element.
    expect(elementPropsByName('Instance')).toBeNull()
    expect(elementPropsByName('Card')).toBeNull()
  })
})
