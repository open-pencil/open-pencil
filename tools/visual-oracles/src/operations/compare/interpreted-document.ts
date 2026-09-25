#!/usr/bin/env bun
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { captureGraphOracle, figmaOracleScript } from '#visual/capture-scene'
import { summarizePathDiagnostics } from '#visual/path-diagnostics'
import { compareSceneOracle, type SceneOracleNode } from '#visual/scene-oracle'
import { $ } from 'bun'

import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { InstancePathDiagnostic } from '@open-pencil/fig/instance-overrides'

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    node: { type: 'string' },
    'figma-key': { type: 'string' },
    'allow-partial-assignments': { type: 'boolean', default: false },
    output: { type: 'string' }
  }
})
if (!values.file || !values.node || !values['figma-key'] || !values.output) {
  throw new Error('Required: --file FILE --node ID --figma-key KEY --output DIR')
}
await mkdir(values.output, { recursive: true })
const script = figmaOracleScript(values['figma-key'], values.node)
const capture = await $`figma-use eval ${script} --json`.quiet().text()
const oracle = JSON.parse(capture) as { fileKey: string; rootId: string; nodes: SceneOracleNode[] }
if (
  oracle.fileKey !== values['figma-key'] ||
  oracle.rootId !== values.node ||
  !Array.isArray(oracle.nodes)
) {
  throw new Error('Invalid oracle capture identity')
}
const { nodeChanges, blobs, images } = parseFigBuffer(await Bun.file(values.file).arrayBuffer())
const diagnostics: InstancePathDiagnostic[] = []
const assignmentDiagnostics: unknown[] = []
const { graph, sources } = materializeDocument(nodeChanges, blobs, {
  images: new Map(images),
  derivedBounds: true,
  onUnresolvedAssignment: values['allow-partial-assignments']
    ? (diagnostic) => assignmentDiagnostics.push(diagnostic)
    : undefined,
  onUnresolvedProperty: (diagnostic) => diagnostics.push(diagnostic)
})
const root = sources.get(values.node)
if (!root) throw new Error('Missing assembled root')
const actual = captureGraphOracle(graph, root, sources)
const differences = compareSceneOracle(oracle.nodes, actual)
const groupedDiagnostics = summarizePathDiagnostics(diagnostics)
for (const [name, value] of Object.entries({
  oracle,
  actual,
  differences,
  diagnostics,
  assignmentDiagnostics,
  groupedDiagnostics
})) {
  await Bun.write(join(values.output, `${name}.json`), JSON.stringify(value, null, 2))
}
const counts: Record<string, number> = {}
for (const difference of differences)
  counts[difference.category] = (counts[difference.category] ?? 0) + 1
console.log(
  JSON.stringify(
    {
      partialAssignmentCallbacks: assignmentDiagnostics.length,
      expectedNodes: oracle.nodes.length,
      actualNodes: actual.length,
      differences: counts,
      uniqueUnresolvedPaths: groupedDiagnostics.length,
      unresolvedCallbacks: diagnostics.length
    },
    null,
    2
  )
)
if (differences.length || assignmentDiagnostics.length) process.exitCode = 1
