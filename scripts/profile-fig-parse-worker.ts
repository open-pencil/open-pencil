#!/usr/bin/env bun
/**
 * Profile .fig parse using the 3-stage Worker pipeline.
 * Usage: bun run scripts/profile-fig-parse-worker.ts path/to/file.fig
 *
 * Uses parseFigFileInWorker(buffer, { profile: true }) — stages run in Workers,
 * timings are collected and printed.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseFigFileInWorker } from '@open-pencil/core'

const file = process.argv[2]
if (!file) {
  console.error('Usage: bun run scripts/profile-fig-parse-worker.ts <path/to/file.fig>')
  process.exit(1)
}

const path = resolve(process.cwd(), file)
const buf = readFileSync(path)
const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer

async function main() {
  const fileSizeMb = (buffer.byteLength / 1024 / 1024).toFixed(2)
  const t0 = performance.now()
  const graph = await parseFigFileInWorker(buffer, { profile: true })
  const t1 = performance.now()

  const profile = (globalThis as unknown as { __FIG_PARSE_PROFILE_RESULT__?: Array<{ stage: string; ms: number }> })
    .__FIG_PARSE_PROFILE_RESULT__
  const total = t1 - t0

  console.log(`\n[fig-parse worker profile] ${file} (${fileSizeMb} MB)`)
  console.log(`  nodes: ${graph.nodes.size}, pages: ${graph.getPages().length}`)
  console.log('')
  if (profile?.length) {
    for (const s of profile) {
      const pct = (100 * s.ms) / total
      console.log(`  ${s.stage}: ${s.ms.toFixed(1)}ms (${pct.toFixed(1)}%)`)
    }
  }
  console.log(`  ---`)
  console.log(`  total: ${total.toFixed(1)}ms`)
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
