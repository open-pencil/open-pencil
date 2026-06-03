#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

interface Metrics {
  figmaSize: string
  openPencilSize: string
  differentPixels: number
  differentPercent: number
  fuzz?: string
  fuzzDifferentPixels?: number
  fuzzDifferentPercent?: number
  rmse: string
}

interface Comparison {
  name: string
  nodeId: string
  output: string
  figmaSize?: string
  openPencilSize?: string
  differentPixels?: number
  differentPercent?: number
  fuzz?: string
  fuzzDifferentPixels?: number
  fuzzDifferentPercent?: number
  rmse?: string
  rmseNormalized?: number
}

interface Report {
  comparisons: Comparison[]
}

const { values: opts } = parseArgs({
  options: {
    report: {
      type: 'string',
      default: 'tests/fixtures/figma-oracles/visual-comparison-report.json'
    },
    name: { type: 'string' },
    metrics: { type: 'string' }
  }
})

if (!opts.name) throw new Error('--name is required')
if (!opts.metrics) throw new Error('--metrics is required')

const report = JSON.parse(readFileSync(opts.report, 'utf8')) as Report
const metrics = JSON.parse(readFileSync(opts.metrics, 'utf8')) as Metrics
const comparison = report.comparisons.find((item) => item.name === opts.name)
if (!comparison) throw new Error(`No comparison named ${opts.name}`)

comparison.figmaSize = metrics.figmaSize
comparison.openPencilSize = metrics.openPencilSize
comparison.differentPixels = metrics.differentPixels
comparison.differentPercent = metrics.differentPercent
comparison.fuzz = metrics.fuzz
comparison.fuzzDifferentPixels = metrics.fuzzDifferentPixels
comparison.fuzzDifferentPercent = metrics.fuzzDifferentPercent
comparison.rmse = metrics.rmse
const normalized = metrics.rmse.split('(')[1]?.split(')')[0]
if (normalized) comparison.rmseNormalized = Number(normalized)

writeFileSync(opts.report, `${JSON.stringify(report, null, 2)}\n`)
console.log(`Updated ${opts.name} in ${opts.report}`)
