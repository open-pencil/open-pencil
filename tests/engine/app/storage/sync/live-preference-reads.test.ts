import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Reads of live, user-mutable storage configuration.
 *
 * Each of these answers "where does this document go?" from state the user can
 * change at any moment. Asking before an `await` pins an answer; asking after
 * one asks a question whose answer may have moved while the code was suspended.
 */
const LIVE_READS = [
  'activeStorageProviderID.value',
  'currentTargetIdFor(',
  'currentStorageTarget(',
  'targetIsCurrent(',
  'readStoragePreferences('
]

const ROOT = new URL('../../../../../', import.meta.url).pathname

const SCANNED_FILES = [
  ...listSourceFiles(join(ROOT, 'src/app/storage')),
  join(ROOT, 'src/views/StorageView.vue'),
  join(ROOT, 'src/app/tabs/index.ts'),
  join(ROOT, 'src/app/document/io/write.ts')
]

/**
 * Reads that are allowed to follow an `await`, each with the reason.
 *
 * Keyed by function rather than by line so the list survives formatting. An
 * entry is a claim that this particular read ESTABLISHES a destination — it
 * decides where a document belongs from here on — rather than recovering one
 * that was already decided. Recovering a destination after an `await` is the
 * defect; deciding one is the feature.
 *
 * Adding an entry should feel like an argument you have to win.
 */
const ALLOWED = [
  {
    file: 'src/app/storage/configured.ts',
    fn: 'refresh',
    why: 'Compares the pinned provider against the live one to discard a stale result. The read IS the staleness check; it never selects a destination.'
  },
  {
    file: 'src/app/storage/documents.ts',
    fn: 'rewriteStorageDocument',
    why: 'Seeds an index-only row for a remote document being renamed or trashed: the row is being created here, so its destination is decided here.'
  },
  {
    file: 'src/app/storage/documents.ts',
    fn: 'duplicateStorageDocument',
    why: 'A duplicate is a brand-new document. Its destination is chosen at creation, not recovered.'
  },
  {
    file: 'src/app/tabs/index.ts',
    fn: 'openStorageDocumentInNewTab',
    why: 'Seeds a row from bytes just downloaded from this provider, so the destination is established by the download that preceded it.'
  }
]

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

/** Script body of a `.vue` SFC, or the whole file for plain TypeScript. */
function scriptSource(path: string): string {
  const source = readFileSync(path, 'utf8')
  if (!path.endsWith('.vue')) return source
  const open = source.indexOf('>', source.indexOf('<script'))
  const close = source.indexOf('</script>')
  if (open === -1 || close === -1) return ''
  // Keep the original offsets so reported line numbers match the file.
  return source.slice(0, open + 1).replace(/[^\n]/g, ' ') + source.slice(open + 1, close)
}

/**
 * Replace comments and literals with spaces of equal length.
 *
 * Blanking rather than deleting keeps every index and line number aligned with
 * the real file, so a reported violation points at the right line.
 */
function blankNonCode(source: string): string {
  const out = source.split('')
  let index = 0
  const blankUntil = (end: number): void => {
    for (let i = index; i < end && i < out.length; i++) {
      if (out[i] !== '\n') out[i] = ' '
    }
    index = end
  }
  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index)
      blankUntil(end === -1 ? source.length : end)
      continue
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      blankUntil(end === -1 ? source.length : end + 2)
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      let cursor = index + 1
      while (cursor < source.length && source[cursor] !== char) {
        if (source[cursor] === '\\') cursor++
        cursor++
      }
      blankUntil(Math.min(cursor + 1, source.length))
      continue
    }
    index++
  }
  return out.join('')
}

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char)
}

/** Index of the `{` that opens a function body, skipping parameters and generics. */
function findBodyStart(code: string, from: number): number {
  let parens = 0
  let angles = 0
  for (let i = from; i < code.length; i++) {
    const char = code[i]
    if (char === '(' || char === '[') parens++
    else if (char === ')' || char === ']') parens--
    else if (char === '<' && isIdentifierChar(code[i - 1])) angles++
    else if (char === '>' && code[i - 1] !== '=' && angles > 0) angles--
    else if (char === '{' && parens === 0 && angles === 0) return i
    else if (char === ';' || char === '\n') {
      // An `async` with no body on the same statement — not a function we can
      // reason about. Give up rather than swallow the rest of the file.
      if (parens === 0 && angles === 0 && char === ';') return -1
    }
  }
  return -1
}

function matchBrace(code: string, open: number): number {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}' && --depth === 0) return i
  }
  return -1
}

type AsyncSpan = { start: number; end: number; name: string }

function functionName(code: string, asyncAt: number): string {
  const after = code.slice(asyncAt + 5, asyncAt + 80)
  const declared = /^\s*function\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(after)
  if (declared?.[1]) return declared[1]
  const method = /^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(after)
  if (method?.[1]) return method[1]
  const before = code.slice(Math.max(0, asyncAt - 80), asyncAt)
  const assigned = /([A-Za-z_$][\w$]*)\s*[:=]\s*$/.exec(before)
  return assigned?.[1] ?? '(anonymous)'
}

function asyncSpans(code: string): AsyncSpan[] {
  const spans: AsyncSpan[] = []
  for (const match of code.matchAll(/\basync\b/g)) {
    const asyncAt = match.index
    const bodyStart = findBodyStart(code, asyncAt + 5)
    if (bodyStart === -1) continue
    const bodyEnd = matchBrace(code, bodyStart)
    if (bodyEnd === -1) continue
    spans.push({ start: bodyStart, end: bodyEnd, name: functionName(code, asyncAt) })
  }
  return spans
}

function innermostSpan(spans: AsyncSpan[], index: number): AsyncSpan | null {
  let best: AsyncSpan | null = null
  for (const span of spans) {
    if (index <= span.start || index >= span.end) continue
    if (!best || span.end - span.start < best.end - best.start) best = span
  }
  return best
}

/**
 * Offsets at which one statement ends and the next begins.
 *
 * This codebase omits semicolons, so a statement ends at a newline that is not
 * inside an open call, index, or parenthesised expression. The distinction
 * matters: in `await f(read())` the read happens BEFORE the suspension and is
 * perfectly safe, while a read on a later statement happens after it.
 */
function statementBreaks(code: string): number[] {
  const breaks: number[] = []
  let depth = 0
  for (let i = 0; i < code.length; i++) {
    const char = code[i]
    if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth--
    else if ((char === '\n' || char === ';') && depth <= 0) breaks.push(i)
  }
  return breaks
}

export type Violation = { file: string; fn: string; line: number; text: string }

type Read = { at: number; pattern: string }

function livePreferenceReads(code: string): Read[] {
  const found: Read[] = []
  for (const pattern of LIVE_READS) {
    let at = code.indexOf(pattern)
    while (at !== -1) {
      found.push({ at, pattern })
      at = code.indexOf(pattern, at + pattern.length)
    }
  }
  return found.sort((a, b) => a.at - b.at)
}

function findViolations(relativePath: string, source: string): Violation[] {
  const code = blankNonCode(source)
  const spans = asyncSpans(code)
  const breaks = statementBreaks(code)
  const awaits = [...code.matchAll(/\bawait\b/g)].map((match) => match.index)
  const lineStarts = [...code.matchAll(/\n/g)].map((match) => match.index)
  const lineOf = (index: number): number => lineStarts.filter((start) => start < index).length + 1

  const suspendedBefore = (read: Read, span: AsyncSpan): boolean =>
    awaits.some(
      (awaitAt) =>
        awaitAt < read.at &&
        // The await must belong to the SAME function. One inside a nested async
        // callback suspends that callback, not this one.
        innermostSpan(spans, awaitAt) === span &&
        breaks.some((breakAt) => breakAt > awaitAt && breakAt < read.at)
    )

  return livePreferenceReads(code).flatMap((read) => {
    const span = innermostSpan(spans, read.at)
    if (!span || !suspendedBefore(read, span)) return []
    return [
      {
        file: relativePath,
        fn: span.name,
        line: lineOf(read.at),
        text: read.pattern
      }
    ]
  })
}

function scan(): Violation[] {
  return SCANNED_FILES.flatMap((path) =>
    findViolations(path.slice(ROOT.length), scriptSource(path))
  )
}

/**
 * Guards the invariant, not today's call sites.
 *
 * Decision 7 of `storage-sync-reliability`: every async path that reads the
 * live provider is a latent instance of "a slow listing retagged a document
 * into the wrong bucket", and shipped guards do not scale — nothing proved the
 * absence of the next one. This is that proof.
 */
describe('no storage path recovers a destination after an await', () => {
  test('every live provider read after an await is on the allowlist', () => {
    const unexplained = scan().filter(
      (violation) =>
        !ALLOWED.some((entry) => entry.file === violation.file && entry.fn === violation.fn)
    )

    expect(
      unexplained.map((violation) => `${violation.file}:${violation.line} in ${violation.fn}()`)
    ).toEqual([])
  })

  test('the allowlist has no stale entries', () => {
    // A stale exemption is worse than none: it silently pre-approves the next
    // read someone adds to that function.
    const found = scan()
    const stale = ALLOWED.filter(
      (entry) => !found.some((v) => v.file === entry.file && v.fn === entry.fn)
    )

    expect(stale.map((entry) => `${entry.file}:${entry.fn}`)).toEqual([])
  })

  test('every allowlist entry carries a reason', () => {
    expect(ALLOWED.every((entry) => entry.why.length > 20)).toBe(true)
  })

  test('the scan actually reaches the storage sources', () => {
    // A scanner that silently matches nothing passes forever. Anchor it to
    // files that must exist and to a read the invariant depends on.
    expect(SCANNED_FILES.some((path) => path.endsWith('src/app/storage/sync/engine.ts'))).toBe(true)
    expect(SCANNED_FILES.length).toBeGreaterThan(10)
    expect(scriptSource(join(ROOT, 'src/views/StorageView.vue'))).toContain(
      'activeStorageProviderID'
    )
  })
})

describe('the scanner catches what it claims to', () => {
  const detect = (source: string): string[] =>
    findViolations('probe.ts', source).map((violation) => violation.fn)

  test('flags a live read on a statement after an await', () => {
    expect(
      detect(`async function seed(id) {
  const meta = await store.getMeta(id)
  return { meta, targetId: currentTargetIdFor(providerId) }
}`)
    ).toEqual(['seed'])
  })

  test('flags a read inside a callback that runs after an await', () => {
    expect(
      detect(`async function paint() {
  const rows = await store.listMetas()
  return rows.filter((row) => row.syncTargetId === currentTargetIdFor(providerId))
}`)
    ).toEqual(['paint'])
  })

  test('accepts a read pinned before the first await', () => {
    expect(
      detect(`async function refresh() {
  const providerId = activeStorageProviderID.value
  await load(providerId)
}`)
    ).toEqual([])
  })

  test('accepts a read evaluated as an argument to the await itself', () => {
    // `await f(read())` evaluates the read before suspending, so it is pinned.
    expect(
      detect(`async function rename(document, name) {
  return await renameStorageDocument(activeStorageProviderID.value, document, name)
}`)
    ).toEqual([])
  })

  test('does not attribute a nested async function’s await to its parent', () => {
    expect(
      detect(`async function outer() {
  const inner = async () => {
    await something()
  }
  return currentTargetIdFor(providerId) && inner
}`)
    ).toEqual([])
  })

  test('ignores a read that only appears in a comment or a string', () => {
    expect(
      detect(`async function documented() {
  await load()
  // never read activeStorageProviderID.value here
  return 'currentTargetIdFor('
}`)
    ).toEqual([])
  })

  test('ignores a synchronous function, which cannot suspend', () => {
    expect(
      detect(`function isCurrentRefresh(generation, providerId) {
  return generation === refreshGeneration && providerId === activeStorageProviderID.value
}`)
    ).toEqual([])
  })
})

/**
 * `runJob` is the single place a destination is turned into an adapter. Every
 * fallback it once had was a silent redirect, so the assertion is about what is
 * ABSENT: no row lookup, no live selection, no `??` chain.
 */
describe('runJob resolves only the target its job captured', () => {
  const engine = readFileSync(join(ROOT, 'src/app/storage/sync/engine.ts'), 'utf8')
  const code = blankNonCode(engine)
  const at = code.indexOf('async function runJob(')
  const bodyStart = findBodyStart(code, at)
  const body = engine.slice(bodyStart, matchBrace(code, bodyStart) + 1)
  const bodyCode = blankNonCode(body)

  test('resolves job.targetId and nothing else', () => {
    expect(at).toBeGreaterThan(0)
    expect(bodyCode).toContain('deps.resolveTarget(job.targetId)')
    expect(bodyCode.match(/resolveTarget\(/g)).toHaveLength(1)
  })

  test('never consults the row or the live selection for a destination', () => {
    expect(bodyCode).not.toContain('syncTargetId')
    expect(bodyCode).not.toContain('activeStorageProviderID')
    expect(bodyCode).not.toContain('currentTargetIdFor')
  })
})
