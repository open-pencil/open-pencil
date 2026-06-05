export interface LcovFunctionRecord {
  hits: number
  line: number
  name: string
}

export interface LcovBranchRecord {
  block: string
  branch: string
  hits: number | null
  line: number
}

export interface LcovFileRecord {
  branches: Map<string, LcovBranchRecord>
  branchTotals: { found: number; hit: number } | null
  functions: Map<string, LcovFunctionRecord>
  functionTotals: { found: number; hit: number } | null
  lineTotals: { found: number; hit: number } | null
  lines: Map<number, number>
  path: string
}

export interface CoverageMetric {
  found: number
  hit: number
  pct: number | null
}

export interface UncoveredFileSummary {
  lineCoverage: number | null
  path: string
  uncoveredLines: number
}

export interface CoverageSummary {
  branches: CoverageMetric | null
  files: number
  functions: CoverageMetric
  lines: CoverageMetric
  statements: CoverageMetric
  uncoveredFiles: UncoveredFileSummary[]
}

function createFileRecord(path: string): LcovFileRecord {
  return {
    path,
    lines: new Map(),
    functions: new Map(),
    branches: new Map(),
    branchTotals: null,
    functionTotals: null,
    lineTotals: null
  }
}

function functionKey(line: number, name: string) {
  return `${line}:${name}`
}

function branchKey(line: number, block: string, branch: string) {
  return `${line}:${block}:${branch}`
}

function percent(hit: number, found: number) {
  if (found === 0) return null
  return (hit / found) * 100
}

export function parseLcov(content: string) {
  const files = new Map<string, LcovFileRecord>()
  let current: LcovFileRecord | null = null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('SF:')) {
      const path = line.slice(3)
      current = files.get(path) ?? createFileRecord(path)
      files.set(path, current)
      continue
    }

    if (line === 'end_of_record') {
      current = null
      continue
    }

    if (!current) continue

    if (line.startsWith('FN:')) {
      const [lineValue, name] = line.slice(3).split(',', 2)
      const fnLine = Number(lineValue)
      if (!Number.isNaN(fnLine) && name) {
        current.functions.set(functionKey(fnLine, name), { line: fnLine, name, hits: 0 })
      }
      continue
    }

    if (line.startsWith('FNDA:')) {
      const [hitsValue, name] = line.slice(5).split(',', 2)
      const hits = Number(hitsValue)
      if (!Number.isNaN(hits) && name) {
        const existing =
          [...current.functions.values()].find((record) => record.name === name) ?? null
        if (existing) {
          existing.hits += hits
        } else {
          current.functions.set(functionKey(0, name), { line: 0, name, hits })
        }
      }
      continue
    }

    if (line.startsWith('FNF:')) {
      const found = Number(line.slice(4))
      current.functionTotals = {
        found: Number.isNaN(found) ? 0 : found,
        hit: current.functionTotals?.hit ?? 0
      }
      continue
    }

    if (line.startsWith('FNH:')) {
      const hit = Number(line.slice(4))
      current.functionTotals = {
        found: current.functionTotals?.found ?? 0,
        hit: Number.isNaN(hit) ? 0 : hit
      }
      continue
    }

    if (line.startsWith('DA:')) {
      const [lineValue, hitsValue] = line.slice(3).split(',', 2)
      const lineNumber = Number(lineValue)
      const hits = Number(hitsValue)
      if (!Number.isNaN(lineNumber) && !Number.isNaN(hits)) {
        current.lines.set(lineNumber, (current.lines.get(lineNumber) ?? 0) + hits)
      }
      continue
    }

    if (line.startsWith('LF:')) {
      const found = Number(line.slice(3))
      current.lineTotals = {
        found: Number.isNaN(found) ? 0 : found,
        hit: current.lineTotals?.hit ?? 0
      }
      continue
    }

    if (line.startsWith('LH:')) {
      const hit = Number(line.slice(3))
      current.lineTotals = {
        found: current.lineTotals?.found ?? 0,
        hit: Number.isNaN(hit) ? 0 : hit
      }
      continue
    }

    if (line.startsWith('BRDA:')) {
      const [lineValue, block, branch, hitsValue] = line.slice(5).split(',', 4)
      const lineNumber = Number(lineValue)
      const hits = hitsValue === '-' ? null : Number(hitsValue)
      if (!Number.isNaN(lineNumber)) {
        current.branches.set(branchKey(lineNumber, block, branch), {
          line: lineNumber,
          block,
          branch,
          hits: Number.isNaN(hits ?? Number.NaN) ? null : hits
        })
      }
      continue
    }

    if (line.startsWith('BRF:')) {
      const found = Number(line.slice(4))
      current.branchTotals = {
        found: Number.isNaN(found) ? 0 : found,
        hit: current.branchTotals?.hit ?? 0
      }
      continue
    }

    if (line.startsWith('BRH:')) {
      const hit = Number(line.slice(4))
      current.branchTotals = {
        found: current.branchTotals?.found ?? 0,
        hit: Number.isNaN(hit) ? 0 : hit
      }
    }
  }

  return files
}

export function mergeLcovMaps(maps: Array<Map<string, LcovFileRecord>>) {
  const merged = new Map<string, LcovFileRecord>()

  for (const lcovMap of maps) {
    for (const [path, record] of lcovMap) {
      const target = merged.get(path) ?? createFileRecord(path)
      merged.set(path, target)

      for (const [lineNumber, hits] of record.lines) {
        target.lines.set(lineNumber, (target.lines.get(lineNumber) ?? 0) + hits)
      }

      for (const fn of record.functions.values()) {
        const key = functionKey(fn.line, fn.name)
        const existing = target.functions.get(key)
        if (existing) {
          existing.hits += fn.hits
        } else {
          target.functions.set(key, { ...fn })
        }
      }

      if (record.functionTotals) {
        target.functionTotals = {
          found: (target.functionTotals?.found ?? 0) + record.functionTotals.found,
          hit: (target.functionTotals?.hit ?? 0) + record.functionTotals.hit
        }
      }

      for (const branch of record.branches.values()) {
        const key = branchKey(branch.line, branch.block, branch.branch)
        const existing = target.branches.get(key)
        if (!existing) {
          target.branches.set(key, { ...branch })
          continue
        }
        if (existing.hits === null || branch.hits === null) {
          existing.hits = existing.hits ?? branch.hits
          continue
        }
        existing.hits += branch.hits
      }

      if (record.branchTotals) {
        target.branchTotals = {
          found: (target.branchTotals?.found ?? 0) + record.branchTotals.found,
          hit: (target.branchTotals?.hit ?? 0) + record.branchTotals.hit
        }
      }

      if (record.lineTotals) {
        target.lineTotals = {
          found: (target.lineTotals?.found ?? 0) + record.lineTotals.found,
          hit: (target.lineTotals?.hit ?? 0) + record.lineTotals.hit
        }
      }
    }
  }

  return merged
}

export function summarizeLcov(files: Map<string, LcovFileRecord>): CoverageSummary {
  let lineFound = 0
  let lineHit = 0
  let functionFound = 0
  let functionHit = 0
  let branchFound = 0
  let branchHit = 0
  const uncoveredFiles: UncoveredFileSummary[] = []

  for (const record of files.values()) {
    const fileLineFound = record.lineTotals?.found ?? record.lines.size
    const fileLineHit =
      record.lineTotals?.hit ?? [...record.lines.values()].filter((hits) => hits > 0).length
    const uncoveredLines = fileLineFound - fileLineHit

    lineFound += fileLineFound
    lineHit += fileLineHit

    functionFound += record.functionTotals?.found ?? record.functions.size
    functionHit +=
      record.functionTotals?.hit ??
      [...record.functions.values()].filter((fn) => fn.hits > 0).length

    branchFound += record.branchTotals?.found ?? record.branches.size
    branchHit +=
      record.branchTotals?.hit ??
      [...record.branches.values()].filter((branch) => (branch.hits ?? 0) > 0).length

    if (uncoveredLines > 0) {
      uncoveredFiles.push({
        path: record.path,
        uncoveredLines,
        lineCoverage: percent(fileLineHit, fileLineFound)
      })
    }
  }

  uncoveredFiles.sort((left, right) => {
    if (right.uncoveredLines !== left.uncoveredLines) {
      return right.uncoveredLines - left.uncoveredLines
    }
    return left.path.localeCompare(right.path)
  })

  return {
    files: files.size,
    lines: {
      found: lineFound,
      hit: lineHit,
      pct: percent(lineHit, lineFound)
    },
    statements: {
      found: lineFound,
      hit: lineHit,
      pct: percent(lineHit, lineFound)
    },
    functions: {
      found: functionFound,
      hit: functionHit,
      pct: percent(functionHit, functionFound)
    },
    branches:
      branchFound > 0
        ? {
            found: branchFound,
            hit: branchHit,
            pct: percent(branchHit, branchFound)
          }
        : null,
    uncoveredFiles
  }
}

export function stringifyLcov(files: Map<string, LcovFileRecord>) {
  const chunks: string[] = []

  for (const record of [...files.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  )) {
    chunks.push(`SF:${record.path}`)

    for (const fn of [...record.functions.values()].sort((left, right) => {
      if (left.line !== right.line) return left.line - right.line
      return left.name.localeCompare(right.name)
    })) {
      chunks.push(`FN:${fn.line},${fn.name}`)
    }

    for (const fn of [...record.functions.values()].sort((left, right) => {
      if (left.line !== right.line) return left.line - right.line
      return left.name.localeCompare(right.name)
    })) {
      chunks.push(`FNDA:${fn.hits},${fn.name}`)
    }

    chunks.push(`FNF:${record.functionTotals?.found ?? record.functions.size}`)
    chunks.push(
      `FNH:${record.functionTotals?.hit ?? [...record.functions.values()].filter((fn) => fn.hits > 0).length}`
    )

    for (const branch of [...record.branches.values()].sort((left, right) => {
      if (left.line !== right.line) return left.line - right.line
      if (left.block !== right.block) return left.block.localeCompare(right.block)
      return left.branch.localeCompare(right.branch)
    })) {
      chunks.push(`BRDA:${branch.line},${branch.block},${branch.branch},${branch.hits ?? '-'}`)
    }

    if ((record.branchTotals?.found ?? record.branches.size) > 0) {
      chunks.push(`BRF:${record.branchTotals?.found ?? record.branches.size}`)
      chunks.push(
        `BRH:${record.branchTotals?.hit ?? [...record.branches.values()].filter((branch) => (branch.hits ?? 0) > 0).length}`
      )
    }

    for (const [lineNumber, hits] of [...record.lines.entries()].sort(
      (left, right) => left[0] - right[0]
    )) {
      chunks.push(`DA:${lineNumber},${hits}`)
    }

    chunks.push(`LF:${record.lineTotals?.found ?? record.lines.size}`)
    chunks.push(
      `LH:${record.lineTotals?.hit ?? [...record.lines.values()].filter((hits) => hits > 0).length}`
    )
    chunks.push('end_of_record')
  }

  return `${chunks.join('\n')}\n`
}

export function formatMetric(metric: CoverageMetric | null) {
  if (!metric || metric.pct === null) return 'n/a'
  return `${metric.pct.toFixed(2)}% (${metric.hit}/${metric.found})`
}
