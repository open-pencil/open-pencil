#!/usr/bin/env bun

import { mkdirSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { $ } from 'bun'

interface FixtureExportTarget {
  file: string
  page: string
  outputName: string
  heavy?: boolean
}

const TARGETS: FixtureExportTarget[] = [
  {
    file: 'tests/fixtures/gold-preview.fig',
    page: 'Page 1',
    outputName: 'gold-preview-page-1.png'
  },
  {
    file: 'tests/fixtures/material3.fig',
    page: 'Getting started',
    outputName: 'material3-getting-started.png'
  },
  {
    file: 'tests/fixtures/nuxtui.fig',
    page: 'Components',
    outputName: 'nuxtui-components.png',
    heavy: true
  }
]

const { values } = parseArgs({
  options: {
    output: { type: 'string', short: 'o', default: '/tmp/open-pencil-fixture-visuals' },
    heavy: { type: 'boolean', default: false }
  }
})

const outputDir = values.output ?? '/tmp/open-pencil-fixture-visuals'
mkdirSync(outputDir, { recursive: true })

for (const target of TARGETS) {
  if (target.heavy && !values.heavy) {
    console.log(`Skipping ${target.file} (${target.page}); pass --heavy to include it.`)
    continue
  }

  const outputPath = `${outputDir}/${target.outputName}`
  console.log(`Exporting ${target.file} / ${target.page} → ${outputPath}`)
  await $`bun open-pencil export ${target.file} --page ${target.page} --output ${outputPath}`
}

console.log(`Fixture visuals written to ${outputDir}`)
