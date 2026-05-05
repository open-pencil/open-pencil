import { describe, expect, test } from 'bun:test'

import {
  clearNodeFillOkHCL,
  colorDistance,
  getFillOkHCL,
  rgbaToOkHCL,
  SceneGraph,
  setNodeFillOkHCL
} from '@open-pencil/core'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

describe('OkHCL toggle conversion', () => {
  test('enabling OkHCL from an existing rgba fill preserves the visible color closely', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const originalColor = { r: 0.22, g: 0.64, b: 0.48, a: 0.83 }
    const node = graph.createNode('FRAME', page.id, {
      fills: [{ type: 'SOLID', visible: true, opacity: originalColor.a, color: originalColor }]
    })

    graph.updateNode(node.id, setNodeFillOkHCL(node, 0, rgbaToOkHCL(originalColor)))
    const updated = getNodeOrThrow(graph, node.id)

    expect(
      colorDistance(originalColor, expectDefined(updated.fills[0], 'updated fill').color)
    ).toBeLessThan(1)
    expect(
      Math.abs(expectDefined(updated.fills[0], 'updated fill').color.a - originalColor.a)
    ).toBeLessThan(0.001)
    expect(getFillOkHCL(updated, 0)).not.toBeNull()
  })

  test('disabling OkHCL removes metadata without changing the rendered color', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const originalColor = { r: 0.71, g: 0.31, b: 0.19, a: 0.92 }
    const node = graph.createNode('FRAME', page.id, {
      fills: [{ type: 'SOLID', visible: true, opacity: originalColor.a, color: originalColor }]
    })

    graph.updateNode(node.id, setNodeFillOkHCL(node, 0, rgbaToOkHCL(originalColor)))
    const withOkHCL = getNodeOrThrow(graph, node.id)
    const renderedBeforeDisable = expectDefined(withOkHCL.fills[0], 'OkHCL fill').color

    graph.updateNode(node.id, clearNodeFillOkHCL(withOkHCL, 0))
    const afterDisable = getNodeOrThrow(graph, node.id)

    expect(getFillOkHCL(afterDisable, 0)).toBeNull()
    expect(
      colorDistance(
        renderedBeforeDisable,
        expectDefined(afterDisable.fills[0], 'fill after disable').color
      )
    ).toBeLessThan(0.001)
  })
})
