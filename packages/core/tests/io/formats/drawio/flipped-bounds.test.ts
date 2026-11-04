import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { RED, worldBox } from '#core-tests/helpers/flipped-layers'

import { parseDrawIOFile } from '@open-pencil/drawio'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'

const io = new IORegistry(BUILTIN_IO_FORMATS)

async function firstCell(graph: SceneGraph, nodeId: string) {
  const result = await io.exportContent('drawio', { graph, target: { scope: 'node', nodeId } })
  if (typeof result.data !== 'string') {
    throw new TypeError('Expected draw.io XML')
  }
  const file = expectDefined(parseDrawIOFile(result.data))
  return expectDefined(expectDefined(file.pages[0]).cells[0], 'cell')
}

function star(props: Partial<SceneNode>) {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0])
  const node = graph.createNode('STAR', page.id, {
    x: 40,
    y: 30,
    width: 60,
    height: 40,
    fills: RED,
    ...props
  })
  return { graph, node, box: worldBox(graph, node) }
}

function groupedFlippedRectangle() {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0])
  const node = graph.createNode('GROUP', page.id, { x: 40, y: 30, width: 60, height: 20 })
  const child = graph.createNode('RECTANGLE', node.id, {
    width: 60,
    height: 20,
    fills: RED,
    flipX: true
  })
  return { graph, node, box: worldBox(graph, child) }
}

const cases = {
  'an unflipped star': star({}),
  'a rotated star': star({ rotation: 30 }),
  'a flipped star': star({ flipX: true }),
  'a rotated and flipped star': star({ flipY: true, rotation: 30 }),
  'a group with a flipped child': groupedFlippedRectangle()
}

describe('draw.io cells of flipped layers', () => {
  for (const [name, { graph, node, box }] of Object.entries(cases)) {
    test(`${name} covers its layer's box on the page`, async () => {
      const { geometry } = await firstCell(graph, node.id)
      expect(geometry.x).toBeCloseTo(box.minX, 1)
      expect(geometry.y).toBeCloseTo(box.minY, 1)
      expect(geometry.width).toBeCloseTo(box.maxX - box.minX, 1)
      expect(geometry.height).toBeCloseTo(box.maxY - box.minY, 1)
    })
  }
})
