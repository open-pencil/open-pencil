#!/usr/bin/env bun
/**
 * Profile .fig parse pipeline. Usage:
 *   bun run scripts/profile-fig-parse.ts path/to/file.fig
 *
 * Enable profiling and run parseFigFile directly (main thread) to measure each stage.
 * Output is printed to stdout.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  parseFigFile,
  getFigParseProfile,
  clearFigParseProfile,
  addFigParseStage,
  computeAllLayouts
} from '@open-pencil/core'

const file = process.argv[2]
if (!file) {
  console.error('Usage: bun run scripts/profile-fig-parse.ts <path/to/file.fig>')
  process.exit(1)
}

;(globalThis as unknown as { __FIG_PARSE_PROFILE__: boolean }).__FIG_PARSE_PROFILE__ = true
clearFigParseProfile()

const path = resolve(process.cwd(), file)
const buf = readFileSync(path)
const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer

async function main() {
  const t0 = performance.now()
  const graph = await parseFigFile(buffer)
  const t1 = performance.now()
  computeAllLayouts(graph)
  const t2 = performance.now()
  addFigParseStage('5_computeAllLayouts', t2 - t1)

  const profile = getFigParseProfile()
  const total = t2 - t0

  console.log(`\n[fig-parse profile] ${file} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`)
  console.log(`  nodes: ${graph.nodes.size}, pages: ${graph.getPages().length}`)
  console.log('')
  for (const s of profile) {
    const pct = (100 * s.ms) / total
    console.log(`  ${s.stage}: ${s.ms.toFixed(1)}ms (${pct.toFixed(1)}%)`)
  }
  console.log(`  ---`)
  console.log(`  total: ${total.toFixed(1)}ms`)
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
