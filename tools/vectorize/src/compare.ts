#!/usr/bin/env bun
/**
 * Compare vendor SVG geometry vs OpenPencil vectorize import.
 *
 *   bun scripts/vectorize-compare.ts path/to/vector.svg
 *   bun scripts/vectorize-compare.ts path/to/vector.svg --width 577 --height 721
 *   bun scripts/vectorize-compare.ts path/to/vector.svg --output /tmp/vectorize-compare
 *
 * Outputs:
 *   raw.svg.png    — flat render of scaled SVG paths (vendor geometry reference)
 *   imported.png   — OpenPencil import (frame + per-path VECTOR children)
 *   side-by-side.png — raw left, imported right
 *   diff.png       — red highlights where import diverges from raw SVG (ImageMagick)
 *   metrics.json   — pixel diff stats; identical=true means import matches reference
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { $ } from 'bun'

import { initCanvasKit } from '@open-pencil/core/io'
import { parseSvgSize, renderVectorizeComparison } from '@open-pencil/core/tools'

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    width: { type: 'string', short: 'w' },
    height: { type: 'string', short: 'h' },
    output: { type: 'string', short: 'o', default: '/tmp/vectorize-compare' },
    background: { type: 'string', default: 'black' }
  }
})

const svgPath = positionals[0]
if (!svgPath) {
  console.error(
    'Usage: bun scripts/vectorize-compare.ts <file.svg> [--width N] [--height N] [--output dir]'
  )
  process.exit(1)
}

const absoluteSvgPath = resolve(svgPath)
if (!existsSync(absoluteSvgPath)) {
  console.error(`SVG not found: ${absoluteSvgPath}`)
  process.exit(1)
}

const svgText = await Bun.file(absoluteSvgPath).text()
const parsedSize = parseSvgSize(svgText)
const width = opts.width ? Number(opts.width) : parsedSize.width
const height = opts.height ? Number(opts.height) : parsedSize.height

if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
  console.error('Target width/height must be positive numbers')
  process.exit(1)
}

const outputDir = resolve(opts.output ?? '/tmp/vectorize-compare')
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

const rawPath = `${outputDir}/raw.svg.png`
const importedPath = `${outputDir}/imported.png`
const sideBySidePath = `${outputDir}/side-by-side.png`
const diffPath = `${outputDir}/diff.png`
const metricsPath = `${outputDir}/metrics.json`

console.log(`📄 SVG: ${absoluteSvgPath}`)
console.log(`📐 Target bounds: ${width}×${height}`)

const ck = await initCanvasKit()
const result = renderVectorizeComparison(
  ck,
  svgText,
  { width, height },
  {
    background: opts.background
  }
)

if (!result) {
  console.error('Could not parse or render SVG paths')
  process.exit(1)
}

await Bun.write(rawPath, result.rawPng)
await Bun.write(importedPath, result.importedPng)
console.log(`   → ${rawPath}`)
console.log(`   → ${importedPath}`)

const metrics = {
  source: basename(absoluteSvgPath),
  ...result.metrics
}

if (await hasMagick()) {
  await $`magick ${rawPath} ${importedPath} +append ${sideBySidePath}`.quiet()
  console.log(`   → ${sideBySidePath}`)

  const compare =
    await $`magick compare -metric AE -highlight-color red -lowlight-color '#FFFFFF33' -compose src ${rawPath} ${importedPath} ${diffPath}`
      .quiet()
      .nothrow()
  const differentPixels = Number.parseInt(compare.stderr.toString().trim(), 10) || 0
  const total = width * height
  metrics.magickDifferentPixels = differentPixels
  metrics.magickDifferentPercent = Number(((differentPixels / total) * 100).toFixed(4))
  console.log(`   → ${diffPath}`)
} else {
  console.log('   ⚠ ImageMagick not found — skipping side-by-side.png and diff.png')
}

writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`)
console.log(`   → ${metricsPath}`)

const importMatches = result.metrics.identical || result.metrics.differentPercent < 0.01

if (importMatches) {
  console.log(
    result.metrics.identical
      ? '✅ Import render matches raw SVG geometry (0 pixel diff)'
      : `✅ Import render matches raw SVG geometry (${result.metrics.differentPixels} px / ${result.metrics.differentPercent}% — sub-pixel edge tolerance)`
  )
} else {
  console.log(
    `⚠ Import diverges from raw SVG: ${result.metrics.differentPixels} px (${result.metrics.differentPercent}%)`
  )
  console.log('   Inspect side-by-side.png and diff.png — red pixels are import bugs.')
  process.exitCode = 2
}

async function hasMagick(): Promise<boolean> {
  const probe = await $`which magick`.quiet().nothrow()
  return probe.exitCode === 0
}
