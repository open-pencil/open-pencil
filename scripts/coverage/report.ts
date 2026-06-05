import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatMetric, mergeLcovMaps, parseLcov, summarizeLcov } from './lcov'

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const UNIT_LCOV = resolve(ROOT, '.context/coverage/unit/lcov.info')
const E2E_LCOV = resolve(ROOT, '.context/coverage/e2e/lcov.info')

function pad(value: string, width: number) {
  return value.padEnd(width)
}

function printSummary(label: string, path: string) {
  const coverage = parseLcov(readFileSync(path, 'utf8'))
  const summary = summarizeLcov(coverage)
  console.log(
    `${pad(label, 8)} ${pad(String(summary.files), 5)} ${pad(formatMetric(summary.statements), 20)} ${pad(formatMetric(summary.branches), 18)} ${pad(formatMetric(summary.lines), 20)} ${formatMetric(summary.functions)}`
  )
  return { coverage, summary }
}

export async function runCoverageReport() {
  const sources = [
    { label: 'unit', path: UNIT_LCOV },
    { label: 'e2e', path: E2E_LCOV }
  ].filter((source) => existsSync(source.path))

  if (sources.length === 0) {
    throw new Error('No coverage artifacts found under .context/coverage/.')
  }

  console.log('Coverage Summary')
  console.log(
    `${pad('Source', 8)} ${pad('Files', 5)} ${pad('Statements', 20)} ${pad('Branches', 18)} ${pad('Lines', 20)} Functions`
  )

  const maps = []
  for (const source of sources) {
    const { coverage } = printSummary(source.label, source.path)
    maps.push(coverage)
  }

  const merged = mergeLcovMaps(maps)
  const mergedSummary = summarizeLcov(merged)
  console.log(
    `${pad('merged', 8)} ${pad(String(mergedSummary.files), 5)} ${pad(formatMetric(mergedSummary.statements), 20)} ${pad(formatMetric(mergedSummary.branches), 18)} ${pad(formatMetric(mergedSummary.lines), 20)} ${formatMetric(mergedSummary.functions)}`
  )

  console.log('')
  console.log(`Uncovered files: ${mergedSummary.uncoveredFiles.length}`)
  for (const file of mergedSummary.uncoveredFiles.slice(0, 5)) {
    const relPath = relative(ROOT, file.path) || file.path
    const coverage = file.lineCoverage === null ? 'n/a' : `${file.lineCoverage.toFixed(2)}% lines`
    console.log(`- ${relPath} — ${file.uncoveredLines} uncovered (${coverage})`)
  }

  if (mergedSummary.branches === null) {
    console.log('')
    console.log(
      'Note: current Bun / demo LCOV artifacts do not emit branch records, so branches are reported as n/a.'
    )
  }
  console.log(
    'Note: statements are derived from executable line records because Bun LCOV does not emit separate statement entries.'
  )
}
