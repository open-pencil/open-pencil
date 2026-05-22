// Run like: bun tests/engine/culling.bench.ts

import { bench, group, run } from 'mitata'

import { getAbsolutePositionFull } from '#core/canvas/coordinate'
import { SceneGraph } from '#core/scene-graph'

/**
 * Benchmark getAbsolutePositionFull cost vs tree depth.
 *
 * getAbsolutePositionFull (coordinate.ts:46-103) walks the full parent chain
 * via getWorldMatrix (O(depth)), computes a world matrix, projects 4 corner
 * points, and also projects the center point. Every call recomputes the full
 * matrix chain from scratch.
 *
 * This benchmark measures per-call time at depths 1, 10, 50, and 100 to
 * quantify the overhead and inform whether caching is necessary.
 */

function createDeepGraph(depth: number): { graph: SceneGraph; leafId: string } {
  const graph = new SceneGraph()
  // graph already has root+page from constructor. Remove auto-created page.
  const rootChildren = graph.getChildren(graph.rootId)
  for (const child of rootChildren) {
    graph.deleteNode(child.id)
  }

  // Create a fresh page
  const page = graph.createNode('CANVAS', graph.rootId, {
    name: 'Benchmark Page',
    width: 0,
    height: 0
  })

  // Build a chain of FRAMEs, each nested inside the previous
  let parentId = page.id
  let leafId = page.id

  for (let i = 0; i < depth; i++) {
    const frame = graph.createNode('FRAME', parentId, {
      name: `Frame ${i}`,
      width: 100,
      height: 100,
      x: 10,
      y: 10,
      rotation: 0
    })
    parentId = frame.id
    leafId = frame.id
  }

  return { graph, leafId }
}

group('getAbsolutePositionFull by tree depth (no caching)', () => {
  for (const depth of [1, 10, 50, 100]) {
    const { graph, leafId } = createDeepGraph(depth)
    const leaf = graph.getNode(leafId)
    if (!leaf) throw new Error(`Leaf node not found at depth ${depth}`)

    bench(`depth=${depth} (${depth + 1} matrix multiplies, no cache)`, () => {
      getAbsolutePositionFull(leaf, graph)
    })
  }
})

group('getAbsolutePositionFull repeated calls (same node, no cache)', () => {
  const { graph, leafId } = createDeepGraph(50)
  const leaf = graph.getNode(leafId)
  if (!leaf) throw new Error('Leaf node not found')

  bench('depth=50, 100 iterations (no cache reuse)', () => {
    for (let i = 0; i < 100; i++) {
      getAbsolutePositionFull(leaf, graph)
    }
  })
})

/**
 * Micro-benchmark: raw Matrix.multiply cost at different depths.
 * This isolates the O(depth) chain-building from the O(1) point-projection.
 */
import Matrix from '#core/canvas/matrix'

function buildMatrixChain(depth: number): Float64Array[] {
  const matrices: Float64Array[] = []
  for (let i = 0; i < depth; i++) {
    // Simulate getNodeLocalMatrix: translate + rotate + translate back
    let m = Matrix.identity()
    m = Matrix.multiply(m, Matrix.translated(10, 10))
    m = Matrix.multiply(m, Matrix.translated(50, 50))
    m = Matrix.multiply(m, Matrix.rotated(0, 0, 0))
    m = Matrix.multiply(m, Matrix.translated(-50, -50))
    matrices.push(m)
  }
  return matrices
}

group('Matrix.multiply chain cost (raw math, no graph traversal)', () => {
  for (const depth of [1, 10, 50, 100]) {
    const chain = buildMatrixChain(depth)

    bench(`chain multiply depth=${depth}`, () => {
      let matrix = Matrix.identity()
      for (const m of chain) {
        matrix = Matrix.multiply(matrix, m)
      }
    })
  }
})

await run()
