import { parseFigBuffer } from '#fig/archive/index'
import { createBindingNormalizer } from '#fig/document/bindings/references'
import { inheritComponentPropertyDefinitions } from '#fig/document/property-inheritance'
import { createArchiveDocumentReader } from '#fig/document/read'
import { createDocumentVariables } from '#fig/document/variables'
import { createIndexedOccurrenceInterpreter } from '#fig/instance-overrides/interpret'
import type {
  InstanceOccurrence,
  InterpretInstanceOptions
} from '#fig/instance-overrides/occurrence/types'
import { createSourceIndex, isActiveRecord } from '#fig/instance-overrides/source-index'
import { compact, isEqual, isPlainObject } from 'es-toolkit'

import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { repoPath } from '@open-pencil/test-support/paths'

/** The raw exports of `packages/fig/crate/src/wasm.rs`. */
interface FigCrateExports {
  memory: WebAssembly.Memory
  alloc(length: number): number
  open(pointer: number, length: number): number
  error(): number
  error_length(): number
  page_count(): number
  page_guid(page: number, part: number): number
  expand_page(page: number): number
  occurrences(): number
  layers(): number
  unresolved(which: number): number
  properties(page: number, first: number, count: number): number
  json(): number
  json_length(): number
}

/** One occurrence of an expanded page, in tree order. */
export interface CrateOccurrence {
  sourceId: string
  depth: number
  flags: number
}

export interface CrateExpansion {
  occurrences: CrateOccurrence[]
  layers: number
  missingComponents: number
  loops: number
}

export interface CrateDocument {
  /** Page ids in saved order. */
  pageIds: string[]
  expand(page: number): CrateExpansion
  /**
   * The field values of `count` occurrences of a page from `first` on, in tree order, as JSON
   * values: 64-bit integers as strings, bytes as arrays of numbers.
   */
  properties(page: number, first: number, count: number): unknown[]
}

let compiled: Promise<WebAssembly.Module> | undefined

/** The module `bun run build:wasm` in `packages/fig` builds; the package's `test` script and the unit test runner build it first. */
function module(): Promise<WebAssembly.Module> {
  compiled ??= Bun.file(repoPath('packages/fig/wasm/fig.wasm'))
    .arrayBuffer()
    .then((bytes) => WebAssembly.compile(bytes))
  return compiled
}

function isExports(value: WebAssembly.Exports): value is WebAssembly.Exports & FigCrateExports {
  return value.memory instanceof WebAssembly.Memory && typeof value.open === 'function'
}

/** Opens a `.fig` file with the Rust reader, in an instance of its own. */
export async function openWithCrate(file: Uint8Array): Promise<CrateDocument> {
  const instance = await WebAssembly.instantiate(await module(), {})
  const crate = instance.exports
  if (!isExports(crate)) throw new Error('fig.wasm does not export the reader')
  const failure = () =>
    new Error(
      new TextDecoder().decode(
        new Uint8Array(crate.memory.buffer, crate.error(), crate.error_length())
      )
    )
  const pointer = crate.alloc(file.length)
  new Uint8Array(crate.memory.buffer, pointer, file.length).set(file)
  if (crate.open(pointer, file.length) < 0) throw failure()
  const pageIds = Array.from(
    { length: crate.page_count() },
    // WebAssembly returns `u32` results as signed numbers; a GUID's halves are unsigned.
    (_, page) => `${crate.page_guid(page, 0) >>> 0}:${crate.page_guid(page, 1) >>> 0}`
  )
  return {
    pageIds,
    expand(page) {
      const count = crate.expand_page(page)
      if (count < 0) throw new Error(`No page ${page}`)
      const rows = new Uint32Array(crate.memory.buffer, crate.occurrences(), count * 4)
      const depths: number[] = []
      const occurrences: CrateOccurrence[] = []
      for (let at = 0; at < count; at++) {
        const parent = rows[at * 4 + 2]
        const depth = parent === 0xffffffff ? 0 : depths[parent] + 1
        depths.push(depth)
        occurrences.push({
          sourceId: `${rows[at * 4]}:${rows[at * 4 + 1]}`,
          depth,
          flags: rows[at * 4 + 3]
        })
      }
      return {
        occurrences,
        layers: crate.layers(),
        loops: crate.unresolved(3),
        missingComponents: crate.unresolved(4)
      }
    },
    properties(page, first, count) {
      if (crate.properties(page, first, count) < 0) throw failure()
      const text = new TextDecoder().decode(
        new Uint8Array(crate.memory.buffer, crate.json(), crate.json_length())
      )
      return compact(text.split('\n')).map((line): unknown => JSON.parse(line, exactIntegers))
    }
  }
}

type Tree = ReadonlyArray<{ sourceId: string; depth: number }>

/** The TypeScript reader's page in the crate's order, depth first. */
function flatten(page: InstanceOccurrence): Array<{ layer: InstanceOccurrence; depth: number }> {
  const layers: Array<{ layer: InstanceOccurrence; depth: number }> = []
  const walk = (layer: InstanceOccurrence, depth: number): void => {
    layers.push({ layer, depth })
    for (const child of layer.children) walk(child, depth + 1)
  }
  walk(page, 0)
  return layers
}

/** Where two trees first differ, as both sides' occurrence there; `null` when they agree. */
function firstDifference(crate: Tree, reader: Tree): string | null {
  const line = (tree: Tree, at: number) =>
    at < tree.length ? `${tree[at].sourceId} at depth ${tree[at].depth}` : 'nothing'
  for (let at = 0; at < Math.max(crate.length, reader.length); at++) {
    if (crate[at]?.sourceId !== reader[at]?.sourceId || crate[at]?.depth !== reader[at]?.depth)
      return `occurrence ${at}: crate ${line(crate, at)}, reader ${line(reader, at)}`
  }
  return null
}

/** Reported, as an editor load reports them, rather than thrown. */
const ignore = () => undefined
const LENIENT: InterpretInstanceOptions = {
  derivedBounds: true,
  onUnresolvedProperty: ignore,
  onUnresolvedAssignment: ignore,
  onMissingComponent: ignore,
  onCyclicComponent: ignore,
  onMissingSlotContent: ignore
}

/** One page as each reader expands it. */
export interface PageComparison {
  id: string
  /** Where the trees first differ, or `null`. */
  difference: string | null
  missingComponents: { crate: number; reader: number }
}

/** Every page of a `.fig` file expanded by the crate and by the TypeScript reader. */
export async function expandWithBoth(file: Uint8Array): Promise<{
  pageIds: { crate: string[]; reader: string[] }
  pages: PageComparison[]
}> {
  const crate = await openWithCrate(file)
  const opened = createArchiveDocumentReader(new Uint8Array(file).buffer, new Set())
  const readerPages = opened.records.flatMap((record) =>
    record.type === 'CANVAS' && record.phase !== 'REMOVED' && record.guid
      ? [guidToString(record.guid)]
      : []
  )
  const pages = crate.pageIds.map((id, page): PageComparison => {
    let missingComponents = 0
    const read = opened.reader.selectPages(new Set([id])).readPage(id, {
      ...LENIENT,
      onMissingComponent: () => missingComponents++
    })
    const expansion = crate.expand(page)
    return {
      id,
      difference: firstDifference(
        expansion.occurrences,
        flatten(read).map(({ layer, depth }) => ({
          sourceId: layer.sourceId,
          depth
        }))
      ),
      missingComponents: {
        crate: expansion.missingComponents,
        reader: missingComponents
      }
    }
  })
  return { pageIds: { crate: crate.pageIds, reader: readerPages }, pages }
}

/**
 * The TypeScript reader's pages over records prepared as the crate prepares them: property
 * bindings and definitions normalized, but styles and library references left as saved and no
 * text style for a claim to give way to, which the crate does not read yet.
 */
function readPagesWithoutStyles(file: Uint8Array): (id: string) => InstanceOccurrence {
  const records = parseFigBuffer(new Uint8Array(file).buffer).nodeChanges.filter(isActiveRecord)
  // No resources, so no library reference resolves.
  const normalize = createBindingNormalizer([])
  for (const record of records) normalize(record)
  inheritComponentPropertyDefinitions(records, createSourceIndex(records).sources)
  const scene = records.filter(
    (record) => record.type !== 'VARIABLE' && record.type !== 'VARIABLE_SET'
  )
  const interpreter = createIndexedOccurrenceInterpreter({
    ...createSourceIndex(scene),
    variables: createDocumentVariables(scene),
    textStyle: () => undefined
  })
  return (id) => {
    const page = interpreter.page(id, LENIENT)
    page.children = page.children.filter((child) => child.properties.isSlotContent !== true)
    return page
  }
}

/**
 * The crate's integers past what a number holds exactly, as their decimal digits, the way
 * `asCrateWrites` writes the reader's.
 */
function exactIntegers(_: string, value: unknown, context?: { source?: string }): unknown {
  if (typeof value !== 'number' || Number.isSafeInteger(value) || !context?.source) return value
  return /^-?\d+$/.test(context.source) ? context.source : value
}

/**
 * A reader's value as the crate writes it: bytes as numbers, and 64-bit integers as numbers, or
 * as their decimal digits past what a number holds exactly.
 */
function asCrateWrites(value: unknown): unknown {
  const text = JSON.stringify(value, (_, inner: unknown) => {
    if (typeof inner === 'bigint') {
      const number = Number(inner)
      return Number.isSafeInteger(number) ? number : String(inner)
    }
    if (inner instanceof Uint8Array) return [...inner]
    return inner
  })
  return text === undefined ? undefined : withoutCopiedDefaults(JSON.parse(text) as unknown)
}

/**
 * A value without the `initialValue` the TypeScript reader copies from a property definition's
 * typed `varValue` for its own use (`normalizeDefaults`), which the crate's typed definitions do
 * not hold where the two kinds differ. Both sides leave out an `initialValue` equal to that copy.
 */
function withoutCopiedDefaults(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutCopiedDefaults)
  if (!isPlainObject(value)) return value
  const result: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value)) result[key] = withoutCopiedDefaults(inner)
  const typed = isPlainObject(result.varValue) ? result.varValue.value : undefined
  if (isPlainObject(typed) && 'initialValue' in result) {
    const symbol = isPlainObject(typed.symbolIdValue) ? typed.symbolIdValue.guid : undefined
    const copied = symbol ? { guidValue: symbol } : typed
    if (isEqual(result.initialValue, copied)) delete result.initialValue
  }
  return result
}

const brief = (value: unknown) => (JSON.stringify(value) ?? 'nothing').slice(0, 160)

/** Every field of a page's layers as each reader gives them. */
export interface FieldComparison {
  id: string
  /** Values compared, one per field each layer has on either side. */
  values: number
  /** The first fields that differ, as both sides' values. */
  differences: string[]
}

/**
 * Every field of every layer of a file's pages, from the crate and from the TypeScript reader
 * without styles. Each page's comparison keeps its first `limit` differences.
 */
export async function readFieldsWithBoth(file: Uint8Array, limit = 5): Promise<FieldComparison[]> {
  const crate = await openWithCrate(file)
  const read = readPagesWithoutStyles(file)
  return crate.pageIds.map((id, page): FieldComparison => {
    const layers = flatten(read(id)).map(({ layer }) => layer)
    const count = crate.expand(page).occurrences.length
    const values = crate.properties(page, 0, count)
    const differences: string[] = []
    let compared = 0
    if (count !== layers.length)
      differences.push(`crate has ${count} layers, reader ${layers.length}`)
    if (values.length !== count)
      differences.push(`crate gave values for ${values.length} of ${count} layers`)
    for (const [at, layer] of layers.entries()) {
      const expected = asCrateWrites(layer.properties)
      const actual = withoutCopiedDefaults(values[at])
      if (!isPlainObject(expected) || !isPlainObject(actual)) continue
      for (const field of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
        compared++
        if (isEqual(expected[field], actual[field]) || differences.length >= limit) continue
        differences.push(
          `${layer.sourceId} ${field}: reader ${brief(expected[field])}, crate ${brief(actual[field])}`
        )
      }
    }
    return { id, values: compared, differences }
  })
}
