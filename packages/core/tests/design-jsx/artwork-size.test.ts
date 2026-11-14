import { describe, expect, test } from 'bun:test'

import { designJSXRenderer } from '@open-pencil/core/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { fetchStub } from '@open-pencil/test-support/fetch'

import { createIconifyAPIClient } from '#core/icons/api'
import { createIconifyProvider } from '#core/icons/provider'

/** One icon whose stroked square spans 2 to 22 of its 24-unit box. */
const SET = {
  prefix: 'test',
  width: 24,
  height: 24,
  icons: {
    square: {
      body: '<path fill="none" stroke="currentColor" stroke-width="2" d="M2 2h20v20H2z"/>'
    }
  }
}

const { renderJSX } = designJSXRenderer(
  createIconifyProvider(
    createIconifyAPIClient(
      fetchStub(async () => Response.json(SET)),
      'https://icons.test'
    )
  )
)

/** The same square as inline SVG. */
function svg(attributes: string): string {
  return `<svg viewBox="0 0 24 24" ${attributes}><path d="M2 2h20v20H2z" fill="none" stroke="#222222" strokeWidth={2} /></svg>`
}

/** The frame's size, and its one path's box and stroke weight. */
async function drawn(jsx: string) {
  const graph = new SceneGraph()
  const [root] = await renderJSX(graph, jsx)
  const frame = expectDefined(graph.getNode(root.id), 'frame')
  const path = expectDefined(graph.getChildren(frame.id)[0], 'path')
  return {
    frame: [frame.width, frame.height],
    path: [path.x, path.y, path.width, path.height].map((value) => Math.round(value * 100) / 100),
    stroke: path.strokes[0]?.weight
  }
}

describe('inline SVG size', () => {
  test('width and height scale the artwork as w and h do', async () => {
    const aliased = await drawn(svg('width={48} height={48}'))
    expect(aliased).toEqual({ frame: [48, 48], path: [4, 4, 40, 40], stroke: 4 })
    expect(aliased).toEqual(await drawn(svg('w={48} h={48}')))
  })

  test('one side set by either name makes a square of it', async () => {
    const aliased = await drawn(svg('width={48}'))
    expect(aliased).toEqual({ frame: [48, 48], path: [4, 4, 40, 40], stroke: 4 })
    expect(aliased).toEqual(await drawn(svg('w={48}')))
  })

  test('width and height win over size, as w and h do', async () => {
    expect(await drawn(svg('width={12} height={12} size={48}'))).toEqual({
      frame: [12, 12],
      path: [1, 1, 10, 10],
      stroke: 1
    })
  })

  test('width and height written as SVG markup writes them count as pixels', async () => {
    const markup = await drawn(svg('width="48" height="48px"'))
    expect(markup).toEqual({ frame: [48, 48], path: [4, 4, 40, 40], stroke: 4 })
  })

  test('a width that depends on what holds the layer leaves the default size', async () => {
    expect(await drawn(svg('width="100%" height="2em"'))).toEqual({
      frame: [24, 24],
      path: [2, 2, 20, 20],
      stroke: 2
    })
  })
})

describe('<Icon> size', () => {
  test('size draws the icon at that size', async () => {
    expect(await drawn('<Icon name="test:square" size={48} />')).toEqual({
      frame: [48, 48],
      path: [4, 4, 40, 40],
      stroke: 4
    })
  })

  test('w and h scale the icon, under either of their names', async () => {
    const sized = await drawn('<Icon name="test:square" w={12} h={12} />')
    expect(sized).toEqual({ frame: [12, 12], path: [1, 1, 10, 10], stroke: 1 })
    expect(sized).toEqual(await drawn('<Icon name="test:square" width={12} height={12} />'))
  })

  test('one side makes a square of it', async () => {
    expect(await drawn('<Icon name="test:square" w={48} />')).toEqual({
      frame: [48, 48],
      path: [4, 4, 40, 40],
      stroke: 4
    })
  })

  test('fits the smaller side of a box that is not square, centered in the other', async () => {
    expect(await drawn('<Icon name="test:square" w={48} h={24} />')).toEqual({
      frame: [48, 24],
      path: [14, 2, 20, 20],
      stroke: 2
    })
    expect(await drawn('<Icon name="test:square" w={24} h={48} />')).toEqual({
      frame: [24, 48],
      path: [2, 14, 20, 20],
      stroke: 2
    })
  })
})
