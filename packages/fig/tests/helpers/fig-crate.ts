import { createArchiveDocumentReader } from '#fig/document/read'
import type {
  InstanceOccurrence,
  InterpretInstanceOptions
} from '#fig/instance-overrides/occurrence/types'
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
  expand_record(session: number, local: number): number
  occurrences(): number
  layers(): number
  unresolved(which: number): number
  properties(page: number, first: number, count: number): number
  record_properties(session: number, local: number, first: number, count: number): number
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

/** What the crate expands: a page by its position, or a component or an instance by its id. */
export type CrateRoot = number | string

export interface CrateDocument {
  /** Page ids in saved order. */
  pageIds: string[]
  expand(root: CrateRoot): CrateExpansion
  /**
   * The field values of `count` occurrences of an expansion from `first` on, in tree order, as
   * JSON values: 64-bit integers as strings, bytes as arrays of numbers.
   */
  properties(root: CrateRoot, first: number, count: number): unknown[]
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
  const guid = (id: string) => {
    const [session, local] = id.split(':').map(Number)
    return [session, local] as const
  }
  return {
    pageIds,
    expand(root) {
      const count =
        typeof root === 'number' ? crate.expand_page(root) : crate.expand_record(...guid(root))
      if (count < 0) throw new Error(`No page or record ${root}`)
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
    properties(root, first, count) {
      const written =
        typeof root === 'number'
          ? crate.properties(root, first, count)
          : crate.record_properties(...guid(root), first, count)
      if (written < 0) throw failure()
      const text = new TextDecoder().decode(
        new Uint8Array(crate.memory.buffer, crate.json(), crate.json_length())
      )
      return compact(text.split('\n')).map((line): unknown => JSON.parse(line))
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
export const LENIENT: InterpretInstanceOptions = {
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

/** A reader's value as the crate writes it: 64-bit integers as strings, bytes as numbers. */
function asCrateWrites(value: unknown): unknown {
  const text = JSON.stringify(value, (_, inner: unknown) => {
    if (typeof inner === 'bigint') return String(inner)
    if (inner instanceof Uint8Array) return [...inner]
    return inner
  })
  return text === undefined ? undefined : (JSON.parse(text) as unknown)
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
 * One expansion as each reader gives it: where the layer trees first differ, then the first
 * fields that differ, up to `limit`.
 */
export function compareLayers(
  read: InstanceOccurrence,
  crate: CrateDocument,
  root: CrateRoot,
  limit = 5
): { values: number; differences: string[] } {
  const layers = flatten(read)
  const { occurrences } = crate.expand(root)
  const tree = firstDifference(
    occurrences,
    layers.map(({ layer, depth }) => ({ sourceId: layer.sourceId, depth }))
  )
  if (tree) return { values: 0, differences: [`layers differ at ${tree}`] }
  const values = crate.properties(root, 0, occurrences.length)
  const differences: string[] = []
  let compared = 0
  for (const [at, { layer }] of layers.entries()) {
    const expected = asCrateWrites(layer.properties)
    const actual = values[at]
    if (!isPlainObject(expected) || !isPlainObject(actual)) continue
    for (const field of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      compared++
      if (isEqual(expected[field], actual[field]) || differences.length >= limit) continue
      differences.push(
        `${layer.sourceId} ${field}: reader ${brief(expected[field])}, crate ${brief(actual[field])}`
      )
    }
  }
  return { values: compared, differences }
}

/**
 * Every field of every layer of a file's pages, from the crate and from the TypeScript reader.
 * Each page's comparison keeps its first `limit` differences.
 */
export async function readFieldsWithBoth(file: Uint8Array, limit = 5): Promise<FieldComparison[]> {
  const crate = await openWithCrate(file)
  const { reader } = createArchiveDocumentReader(new Uint8Array(file).buffer, new Set())
  return crate.pageIds.map((id, page): FieldComparison => {
    const read = reader.selectPages(new Set([id])).readPage(id, LENIENT)
    return { id, ...compareLayers(read, crate, page, limit) }
  })
}
