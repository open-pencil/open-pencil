#!/usr/bin/env bun
/**
 * Profile .fig parse pipeline with memory monitoring. Usage:
 *   bun run scripts/profile-fig-parse-memory.ts path/to/file.fig
 *
 * Reports process.memoryUsage() before parse, after parse, and after layout.
 * Useful for verifying memory reductions (e.g. structuredClone → copyFills).
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

function mb(n: number) {
  return (n / 1024 / 1024).toFixed(2)
}

function reportMemory(label: string) {
  const m = process.memoryUsage()
  console.log(
    `  [${label}] heapUsed: ${mb(m.heapUsed)} MB, heapTotal: ${mb(m.heapTotal)} MB, rss: ${mb(m.rss)} MB`
  )
  return m
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: bun run scripts/profile-fig-parse-memory.ts <path/to/file.fig>')
  process.exit(1)
}

;(globalThis as unknown as { __FIG_PARSE_PROFILE__: boolean }).__FIG_PARSE_PROFILE__ = true
clearFigParseProfile()

const path = resolve(process.cwd(), file)
const buf = readFileSync(path)
const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer

async function main() {
  reportMemory('before parse')

  const t0 = performance.now()
  const graph = await parseFigFile(buffer)
  const t1 = performance.now()
  const afterParse = reportMemory('after parse')

  computeAllLayouts(graph)
  const t2 = performance.now()
  const afterLayout = reportMemory('after layout')

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
  console.log('[memory] peak heapUsed after parse:', mb(afterParse.heapUsed), 'MB')
  console.log('[memory] after layout:', mb(afterLayout.heapUsed), 'MB')
  console.log('')
}

await main().catch((e) => {
  console.error(e)
  process.exit(1)
})
