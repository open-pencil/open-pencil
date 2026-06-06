import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Filter records out of an LCOV file whose SF: path matches one of the exclude
 * patterns. Used to drop generated build artifacts (packages/*\/dist) and
 * vendored dependencies (node_modules) that inflate the coverage denominator.
 */

const DEFAULT_EXCLUDE_PATTERNS = [
  /(^|\/)packages\/[^/]+\/dist\//,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /\.test\.[tj]sx?$/
]

interface FilterOptions {
  input: string
  output: string
  patterns: RegExp[]
}

function filterLcov({ input, output, patterns }: FilterOptions) {
  const content = readFileSync(input, 'utf8')
  const records = content.split(/end_of_record\s*\n/)

  let kept = 0
  let dropped = 0
  const filtered: string[] = []

  for (const block of records) {
    const sfMatch = block.match(/^SF:(.+)$/m)
    if (!sfMatch) {
      // Tail block without SF — usually trailing empty string.
      continue
    }
    const sourceFile = sfMatch[1]
    const excluded = patterns.some((pattern) => pattern.test(sourceFile))
    if (excluded) {
      dropped++
      continue
    }
    filtered.push(`${block.trim()}\nend_of_record\n`)
    kept++
  }

  writeFileSync(output, filtered.join(''))
  console.log(`[filter-lcov] kept=${kept} dropped=${dropped} → ${output}`)
}

const cwd = process.cwd()
const inputPath = resolve(cwd, process.argv[2] ?? '.context/coverage/unit/lcov.info')
const outputPath = resolve(cwd, process.argv[3] ?? inputPath)

filterLcov({
  input: inputPath,
  output: outputPath,
  patterns: DEFAULT_EXCLUDE_PATTERNS
})
