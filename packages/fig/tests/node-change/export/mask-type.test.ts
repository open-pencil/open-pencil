import { beforeAll, describe, expect, test } from 'bun:test'

import { nodeChangeToProps, sceneNodeToKiwi } from '#fig/node-change/index'

import { getCompiledSchema, initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

function vectorMaskRecord() {
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    isMask: true,
    maskType: 'VECTOR'
  })
  return sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])[0]
}

describe('Figma vector mask type', () => {
  beforeAll(() => initCodec())

  test('exports a vector mask as OUTLINE so the .fig schema can encode it', () => {
    const change = vectorMaskRecord()
    expect(change.mask).toBe(true)
    expect(change.maskType).toBe('OUTLINE')
    expect(() => getCompiledSchema().encodeNodeChange(change)).not.toThrow()
  })

  test('imports OUTLINE as a vector mask', () => {
    const props = nodeChangeToProps(
      { type: 'RECTANGLE', mask: true, maskType: 'OUTLINE' } as NodeChange,
      []
    )
    expect(props.isMask).toBe(true)
    expect(props.maskType).toBe('VECTOR')
  })

  test('round-trips a vector mask through an encoded node change', () => {
    const change = vectorMaskRecord()
    const codec = getCompiledSchema()
    const encoded = codec.encodeMessage({ type: 'NODE_CHANGES', nodeChanges: [change] })
    const decoded = codec.decodeMessage(encoded) as { nodeChanges: NodeChange[] }
    expect(decoded.nodeChanges[0]?.maskType).toBe('OUTLINE')
    expect(nodeChangeToProps(decoded.nodeChanges[0], []).maskType).toBe('VECTOR')
  })
})
