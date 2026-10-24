import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { pick } from 'es-toolkit/object'

import { createEditor, isEmptyDocumentChange } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import type { SceneGraph } from '@open-pencil/scene-graph'

const render = expectDefined(
  ALL_TOOLS.find((tool) => tool.name === 'render'),
  'render tool'
)

/**
 * Every layer on the page by id, as the user sees it: its name, place, and children. Copied,
 * as the graph edits child lists in place.
 */
function pageLayers(graph: SceneGraph, pageId: string) {
  const layers = new Map<string, Record<string, unknown>>()
  const walk = (id: string) => {
    const node = expectDefined(graph.getNode(id), `layer ${id}`)
    layers.set(
      id,
      structuredClone(
        pick(node, ['name', 'type', 'parentId', 'childIds', 'x', 'y', 'width', 'height'])
      )
    )
    for (const childId of node.childIds) walk(childId)
  }
  walk(pageId)
  return layers
}

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  editor.graph.createNode('RECTANGLE', pageId, { name: 'Photo', width: 1080, height: 1350 })
  const figma = new FigmaAPI(editor.graph)
  return { editor, pageId, figma }
}

/**
 * Runs a render that must fail, recording what it changed as the chat and the automation
 * bridge do: a change that is not empty becomes an undo step and a change card.
 */
async function renderFailing(
  { editor, pageId, figma }: ReturnType<typeof setup>,
  args: Parameters<typeof render.execute>[1]
) {
  const layersBefore = pageLayers(editor.graph, pageId)
  const nodesBefore = editor.graph.nodes.size
  const finish = editor.captureDocumentChange(pageId)
  const error = await Promise.resolve(render.execute(figma, args)).then(
    () => {
      throw new Error('the render succeeded')
    },
    (error: unknown) => error
  )
  return { error, change: finish(), layersBefore, nodesBefore }
}

const AD = '<Frame name="Ad C – 9:16" w={1080} h={1920} bg="#111">'
const BACKDROP = '<Rect name="Backdrop" w={1080} h={1920} bg="#222" />'
const HEADLINE = '<Text name="Headline" size={64} color="#fff">Big sale</Text>'

/** Each way a render can fail once the layers before the failing element exist. */
const FAILURES: Array<[string, string, string]> = [
  [
    'an icon named without its set',
    `${AD}${BACKDROP}${HEADLINE}<Icon name="Icon" size={48} /></Frame>`,
    'Invalid icon name "Icon". Use prefix:name format (e.g. lucide:heart, mdi:home)'
  ],
  [
    'an element that does not exist',
    `${AD}${BACKDROP}<bogus /></Frame>`,
    'Unknown element: <bogus>'
  ],
  [
    'an instance of a component that does not exist',
    `${AD}${BACKDROP}<Instance of="Nope" /></Frame>`,
    '<Instance> component not found: Nope'
  ],
  [
    'an inline SVG with nothing to draw',
    `${AD}${BACKDROP}<svg viewBox="0 0 24 24" size={24} /></Frame>`,
    '<svg> requires SVG markup, a body prop, or supported SVG shape children'
  ],
  [
    'text content outside <Text>',
    `${AD}${BACKDROP}<Span>loose</Span></Frame>`,
    '<Span> must be inside <Text>'
  ]
]

describe('render', () => {
  test.each(FAILURES)(
    'a render that fails on %s leaves the page as it was',
    async (_what, jsx, message) => {
      const fixture = setup()
      const { error, change, layersBefore, nodesBefore } = await renderFailing(fixture, { jsx })

      expect(error).toMatchObject({ message: expect.stringContaining(message) })
      expect(pageLayers(fixture.editor.graph, fixture.pageId)).toEqual(layersBefore)
      expect(fixture.editor.graph.nodes.size).toBe(nodesBefore)
      // What the chat would record as the undo step and show as the call's change.
      expect(isEmptyDocumentChange(change)).toBe(true)
    }
  )

  test('a render that fails while replacing a layer keeps that layer where it was', async () => {
    const fixture = setup()
    const { editor, pageId } = fixture
    const row = editor.graph.createNode('FRAME', pageId, {
      name: 'Row',
      layoutMode: 'HORIZONTAL',
      width: 400,
      height: 100
    })
    const left = editor.graph.createNode('RECTANGLE', row.id, {
      name: 'Left',
      width: 100,
      height: 100
    })
    const placeholder = editor.graph.createNode('RECTANGLE', row.id, {
      name: 'Placeholder',
      width: 100,
      height: 100
    })
    const { error, change, layersBefore, nodesBefore } = await renderFailing(fixture, {
      replace_id: placeholder.id,
      jsx: `<Frame name="Badge" w={100} h={100}>${BACKDROP}<Icon name="Icon" /></Frame>`
    })

    expect(error).toMatchObject({ message: expect.stringContaining('Invalid icon name "Icon"') })
    expect(pageLayers(editor.graph, pageId)).toEqual(layersBefore)
    expect(editor.graph.nodes.size).toBe(nodesBefore)
    expect(editor.graph.getNode(row.id)?.childIds).toEqual([left.id, placeholder.id])
    expect(isEmptyDocumentChange(change)).toBe(true)
  })
})
