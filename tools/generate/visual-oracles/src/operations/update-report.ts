#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import * as v from 'valibot'

const MetricsJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    figmaSize: v.string(),
    openPencilSize: v.string(),
    differentPixels: v.number(),
    differentPercent: v.number(),
    fuzz: v.optional(v.string()),
    fuzzDifferentPixels: v.optional(v.number()),
    fuzzDifferentPercent: v.optional(v.number()),
    rmse: v.string()
  })
)

// The report is written back in place, so loose objects keep fields this script does not own.
const ReportJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.looseObject({
    comparisons: v.array(
      v.looseObject({
        name: v.string(),
        nodeId: v.string(),
        output: v.string(),
        figmaSize: v.optional(v.string()),
        openPencilSize: v.optional(v.string()),
        differentPixels: v.optional(v.number()),
        differentPercent: v.optional(v.number()),
        fuzz: v.optional(v.string()),
        fuzzDifferentPixels: v.optional(v.number()),
        fuzzDifferentPercent: v.optional(v.number()),
        rmse: v.optional(v.string()),
        rmseNormalized: v.optional(v.number())
      })
    )
  })
)

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

const report = v.parse(ReportJSON, readFileSync(opts.report, 'utf8'))
const metrics = v.parse(MetricsJSON, readFileSync(opts.metrics, 'utf8'))
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
