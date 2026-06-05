import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { TraceMap, decodedMappings, originalPositionFor } from '@jridgewell/trace-mapping'

import type { LcovFileRecord } from './lcov'
import { stringifyLcov } from './lcov'

type RawCoverageRange = {
  count: number
  endOffset: number
  startOffset: number
}

type RawCoverageFunction = {
  functionName: string
  ranges: RawCoverageRange[]
}

type RawCoverageEntry = {
  functions: RawCoverageFunction[]
  scriptId: string
  source?: string
  url: string
}

type RawCoverageArtifact = {
  coverage: RawCoverageEntry[]
}

type FileCoverageAccumulator = {
  branches: Map<string, never>
  functions: Map<string, { hits: number; line: number; name: string }>
  lines: Map<number, number>
  path: string
}

type CoveredInterval = {
  end: number
  hits: number
  start: number
}

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const DIST_DIR = resolve(ROOT, 'dist')
const TEST_RESULTS_DIR = resolve(ROOT, 'test-results')
const COVERAGE_DIR = resolve(ROOT, '.context/coverage/e2e')
const RAW_DIR = resolve(COVERAGE_DIR, 'raw')
const TRACE_DIR = resolve(COVERAGE_DIR, 'traces')
const LCOV_PATH = resolve(COVERAGE_DIR, 'lcov.info')
const SPEC_PATH = 'tests/e2e/interaction/dashboard.interaction.spec.ts'

function createFileCoverage(path: string): FileCoverageAccumulator {
  return {
    path,
    lines: new Map(),
    functions: new Map(),
    branches: new Map()
  }
}

function functionKey(line: number, name: string) {
  return `${line}:${name}`
}

function runCommand(command: string[], env: NodeJS.ProcessEnv = process.env) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      env,
      stdio: 'inherit'
    })

    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(
        new Error(`Command failed (${command.join(' ')}): ${signal ?? code ?? 'unknown error'}`)
      )
    })
  })
}

function startServer(command: string[], env: NodeJS.ProcessEnv = process.env) {
  const child = spawn(command[0], command.slice(1), {
    cwd: ROOT,
    env,
    stdio: 'inherit'
  })
  return child
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await once(child, 'exit').catch(() => {})
}

async function waitForHttp(url: string, timeoutMs: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status < 500) return
    } catch {}
    await Bun.sleep(500)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function lineStarts(source: string) {
  const starts = [0]
  for (let index = 0; index < source.length; index++) {
    if (source.charCodeAt(index) === 10) starts.push(index + 1)
  }
  return starts
}

function offsetToLineColumn(starts: number[], offset: number, sourceLength: number) {
  let low = 0
  let high = starts.length - 1
  const boundedOffset = Math.max(0, Math.min(offset, sourceLength))

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const start = starts[mid] ?? 0
    const next = starts[mid + 1] ?? sourceLength + 1
    if (boundedOffset < start) {
      high = mid - 1
      continue
    }
    if (boundedOffset >= next) {
      low = mid + 1
      continue
    }
    return { line: mid, column: boundedOffset - start }
  }

  const line = Math.max(0, starts.length - 1)
  return { line, column: boundedOffset - (starts[line] ?? 0) }
}

function recordIntervals(entry: RawCoverageEntry) {
  const source = entry.source ?? ''
  const starts = lineStarts(source)
  const lines = source.split('\n')
  const intervals = new Map<number, CoveredInterval[]>()

  for (const fn of entry.functions) {
    for (const range of fn.ranges) {
      if (range.count <= 0) continue
      const start = offsetToLineColumn(starts, range.startOffset, source.length)
      const end = offsetToLineColumn(
        starts,
        Math.max(range.startOffset, range.endOffset - 1),
        source.length
      )
      for (let line = start.line; line <= end.line; line++) {
        const lineText = lines[line] ?? ''
        const startColumn = line === start.line ? start.column : 0
        const endColumn = line === end.line ? end.column + 1 : lineText.length
        const bucket = intervals.get(line) ?? []
        bucket.push({ start: startColumn, end: endColumn, hits: range.count })
        intervals.set(line, bucket)
      }
    }
  }

  return { intervals, starts }
}

function overlapsCoverage(intervals: CoveredInterval[] | undefined, start: number, end: number) {
  if (!intervals || intervals.length === 0) return 0
  let hits = 0
  for (const interval of intervals) {
    if (interval.end <= start || interval.start >= end) continue
    hits = Math.max(hits, interval.hits)
  }
  return hits
}

function resolveSourcePath(mapPath: string, sourcePath: string) {
  if (!sourcePath || sourcePath.startsWith('\0')) return null
  if (sourcePath.includes('node_modules')) return null
  const resolved = resolve(dirname(mapPath), sourcePath)
  if (!resolved.startsWith(ROOT)) return null
  return resolved
}

function toLcovRecord(accumulator: FileCoverageAccumulator): LcovFileRecord {
  return {
    path: accumulator.path,
    lines: accumulator.lines,
    functions: accumulator.functions,
    branches: new Map(),
    branchTotals: null,
    functionTotals: null,
    lineTotals: null
  }
}

function collectGeneratedFallback(
  records: Map<string, FileCoverageAccumulator>,
  jsPath: string,
  entry: RawCoverageEntry
) {
  const record = records.get(jsPath) ?? createFileCoverage(jsPath)
  records.set(jsPath, record)
  const { intervals, starts } = recordIntervals(entry)

  for (let lineIndex = 0; lineIndex < starts.length; lineIndex++) {
    const hits = overlapsCoverage(intervals.get(lineIndex), 0, Number.POSITIVE_INFINITY)
    const lineNumber = lineIndex + 1
    record.lines.set(lineNumber, Math.max(record.lines.get(lineNumber) ?? 0, hits))
  }

  for (const fn of entry.functions) {
    const range = fn.ranges[0]
    if (!range) continue
    const position = offsetToLineColumn(starts, range.startOffset, entry.source?.length ?? 0)
    const lineNumber = position.line + 1
    const name = fn.functionName || `anonymous_${lineNumber}_${position.column}`
    record.functions.set(functionKey(lineNumber, name), {
      line: lineNumber,
      name,
      hits: Math.max(...fn.ranges.map((candidate) => candidate.count))
    })
  }
}

function applyMappedCoverage(
  records: Map<string, FileCoverageAccumulator>,
  jsPath: string,
  entry: RawCoverageEntry
) {
  const mapPath = `${jsPath}.map`
  if (!existsSync(mapPath)) {
    collectGeneratedFallback(records, jsPath, entry)
    return
  }

  const sourceMap = JSON.parse(readFileSync(mapPath, 'utf8')) as {
    mappings: string
    sources: string[]
  }
  const traceMap = new TraceMap(sourceMap)
  const mappings = decodedMappings(traceMap)
  const { intervals, starts } = recordIntervals(entry)

  for (let generatedLineIndex = 0; generatedLineIndex < mappings.length; generatedLineIndex++) {
    const segments = mappings[generatedLineIndex]
    if (!segments || segments.length === 0) continue

    const coveredIntervals = intervals.get(generatedLineIndex)
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex]
      if (!segment || segment.length < 4) continue
      const generatedStart = segment[0] ?? 0
      const nextSegment = segments[segmentIndex + 1]
      const generatedEnd = nextSegment?.[0] ?? Number.POSITIVE_INFINITY
      const sourceIndex = segment[1]
      const sourceLine = segment[2]
      const sourcePath = sourceMap.sources[sourceIndex]
      const resolvedSource = resolveSourcePath(mapPath, sourcePath)
      if (!resolvedSource) continue

      const record = records.get(resolvedSource) ?? createFileCoverage(resolvedSource)
      records.set(resolvedSource, record)

      const sourceLineNumber = sourceLine + 1
      if (!record.lines.has(sourceLineNumber)) record.lines.set(sourceLineNumber, 0)
      const hits = overlapsCoverage(coveredIntervals, generatedStart, generatedEnd)
      if (hits > 0) {
        record.lines.set(sourceLineNumber, (record.lines.get(sourceLineNumber) ?? 0) + hits)
      }
    }
  }

  for (const fn of entry.functions) {
    const range = fn.ranges[0]
    if (!range) continue
    const position = offsetToLineColumn(starts, range.startOffset, entry.source?.length ?? 0)
    const original = originalPositionFor(traceMap, {
      line: position.line + 1,
      column: position.column
    })
    if (original.line === null || original.column === null || original.source === null) continue
    const resolvedSource = resolveSourcePath(mapPath, original.source)
    if (!resolvedSource) continue

    const record = records.get(resolvedSource) ?? createFileCoverage(resolvedSource)
    records.set(resolvedSource, record)

    const lineNumber = original.line
    const name = fn.functionName || `anonymous_${lineNumber}_${original.column}`
    const existing = record.functions.get(functionKey(lineNumber, name))
    const hits = Math.max(...fn.ranges.map((candidate) => candidate.count))
    if (existing) {
      existing.hits += hits
    } else {
      record.functions.set(functionKey(lineNumber, name), {
        line: lineNumber,
        name,
        hits
      })
    }
  }
}

function walkFiles(root: string, matcher: (path: string) => boolean, bucket: string[] = []) {
  if (!existsSync(root)) return bucket
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      walkFiles(path, matcher, bucket)
      continue
    }
    if (matcher(path)) bucket.push(path)
  }
  return bucket
}

function readRawArtifacts() {
  return walkFiles(RAW_DIR, (path) => path.endsWith('.json')).map(
    (path) => JSON.parse(readFileSync(path, 'utf8')) as RawCoverageArtifact
  )
}

function writeE2ELcov() {
  const records = new Map<string, FileCoverageAccumulator>()
  for (const artifact of readRawArtifacts()) {
    for (const entry of artifact.coverage) {
      const url = new URL(entry.url)
      if (url.origin !== 'http://localhost:1420') continue
      if (!url.pathname.endsWith('.js')) continue

      const jsPath = resolve(DIST_DIR, `.${url.pathname}`)
      if (!existsSync(jsPath)) continue
      applyMappedCoverage(records, jsPath, entry)
    }
  }

  const lcovRecords = new Map(
    [...records.entries()].map(([path, record]) => [path, toLcovRecord(record)])
  )
  mkdirSync(COVERAGE_DIR, { recursive: true })
  writeFileSync(LCOV_PATH, stringifyLcov(lcovRecords))
}

function copyTraceArtifacts() {
  const traceFiles = walkFiles(TEST_RESULTS_DIR, (path) => path.endsWith('trace.zip'))
  mkdirSync(TRACE_DIR, { recursive: true })
  for (const traceFile of traceFiles) {
    const relPath = relative(TEST_RESULTS_DIR, traceFile).replaceAll('/', '__')
    cpSync(traceFile, resolve(TRACE_DIR, relPath))
  }
}

function resetArtifacts() {
  rmSync(COVERAGE_DIR, { recursive: true, force: true })
  rmSync(TEST_RESULTS_DIR, { recursive: true, force: true })
}

export async function runMeasureE2ECoverage() {
  resetArtifacts()

  await runCommand(['bunx', 'vite', 'build', '--sourcemap', '--minify=false'], {
    ...process.env,
    VITE_INKLY_AUTH_TEST_MODE: '1'
  })

  const previewServer = startServer([
    'bunx',
    'vite',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '1420',
    '--strictPort'
  ])
  const apiServer = startServer(['bun', '--filter', '@inkly/api', 'dev'], {
    ...process.env,
    INKLY_API_AUTH_ENABLE_TEST_UTILS: '1',
    INKLY_API_DB_MODE: 'memory',
    INKLY_API_JWT_SECRET: 'playwright-secret'
  })

  try {
    await Promise.all([
      waitForHttp('http://127.0.0.1:1420', 60_000),
      waitForHttp('http://127.0.0.1:3001/api/auth/session', 60_000)
    ])

    await runCommand(
      [
        'bunx',
        'playwright',
        'test',
        '--config',
        'playwright.config.ts',
        '--project=inkly',
        '--trace=on',
        SPEC_PATH
      ],
      {
        ...process.env,
        INKLY_E2E_COVERAGE: '1'
      }
    )

    copyTraceArtifacts()
    writeE2ELcov()
    console.log(`E2E demo coverage written to ${relative(ROOT, LCOV_PATH)}`)
  } finally {
    await Promise.all([stopServer(previewServer), stopServer(apiServer)])
  }
}
