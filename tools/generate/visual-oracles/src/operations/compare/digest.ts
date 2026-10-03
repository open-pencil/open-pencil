#!/usr/bin/env bun
import { parseArgs } from 'node:util'

import { captureDocumentOracle } from '#visual/capture/document'
import { compareSceneOracle, type SceneOracleNode } from '#visual/scene-oracle'

import { materializeFigArchive } from '@open-pencil/fig'

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    out: { type: 'string' },
    baseline: { type: 'string' },
    show: { type: 'string', default: '20' }
  }
})
if (!values.file) throw new Error('Required: --file FILE [--out FILE] [--baseline FILE]')

// A reader change often moves these counts too, so report them beside the node capture.
const unresolved = { assignment: 0, property: 0, binding: 0, component: 0 }
const { graph, sources } = materializeFigArchive(await Bun.file(values.file).arrayBuffer(), {
  derivedBounds: true,
  onUnresolvedAssignment: () => unresolved.assignment++,
  onUnresolvedProperty: () => unresolved.property++,
  onUnresolvedBinding: () => unresolved.binding++,
  onMissingComponent: () => unresolved.component++
})
const nodes = captureDocumentOracle(graph, sources)
if (values.out) await Bun.write(values.out, JSON.stringify(nodes))

if (!values.baseline) {
  console.log(
    JSON.stringify({ nodes: nodes.length, pages: graph.getPages().length, unresolved }, null, 2)
  )
} else {
  const baseline = (await Bun.file(values.baseline).json()) as SceneOracleNode[]
  const differences = compareSceneOracle(baseline, nodes)
  const counts: Record<string, number> = {}
  for (const difference of differences)
    counts[difference.category] = (counts[difference.category] ?? 0) + 1
  console.log(
    JSON.stringify(
      { baselineNodes: baseline.length, nodes: nodes.length, differences: counts, unresolved },
      null,
      2
    )
  )
  for (const difference of differences.slice(0, Number(values.show))) {
    const { path, field, category, expected, actual } = difference
    console.log(
      `  ${category} ${path.join(',')} ${field}: ${JSON.stringify(expected)} -> ${JSON.stringify(actual)}`
    )
  }
  if (differences.length) process.exitCode = 1
}
