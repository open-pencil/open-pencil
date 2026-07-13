import { describe, expect, test } from 'bun:test'

import { reactive } from 'vue'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { GeometryPath } from '@open-pencil/scene-graph'
import { toRawDeep } from '@open-pencil/scene-graph/raw'

import { expectDefined } from '#tests/helpers/assert'

function blob(): Uint8Array {
  return new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
}

function geometry(): GeometryPath[] {
  return [{ windingRule: 'NONZERO', commandsBlob: blob() }]
}

// Stored reactive proxies poison the doc for structuredClone consumers
// (export subgraph clone, undo snapshots) with DataCloneError.
describe('scene graph rejects Vue reactive proxies', () => {
  test('toRawDeep unwraps proxies nested inside plain containers', () => {
    const wrapped = reactive({ paths: geometry() })
    // Spreading a reactive array yields a plain array of proxied elements.
    const mixed = [...wrapped.paths]
    expect(() => structuredClone(mixed)).toThrow()
    expect(() => structuredClone(toRawDeep(mixed))).not.toThrow()
  })

  test('updateNode stores clone-safe values from reactive changes', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const node = graph.createNode('VECTOR', page.id, { width: 10, height: 10 })

    const changes = reactive({ strokeGeometry: geometry(), fillGeometry: [] as GeometryPath[] })
    graph.updateNode(node.id, changes)

    // Whole-node clone mirrors export's extractExportGraph.
    expect(() => structuredClone(expectDefined(graph.getNode(node.id)))).not.toThrow()
  })

  test('updateNodePreview stores clone-safe values from reactive changes', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const node = graph.createNode('VECTOR', page.id, { width: 10, height: 10 })

    const changes = reactive({ strokeGeometry: geometry() })
    graph.updateNodePreview(node.id, changes)

    expect(() => structuredClone(expectDefined(graph.getNode(node.id)))).not.toThrow()
  })

  test('createNode stores clone-safe values from reactive overrides', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const overrides = reactive({ width: 10, height: 10, fillGeometry: geometry() })
    const node = graph.createNode('VECTOR', page.id, overrides)

    expect(() => structuredClone(expectDefined(graph.getNode(node.id)))).not.toThrow()
  })
})
