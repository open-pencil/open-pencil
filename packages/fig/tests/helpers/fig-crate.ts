import { createArchiveDocumentReader } from '#fig/document/read'
import type { InstanceOccurrence } from '#fig/instance-overrides/occurrence/types'

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
  placements(): number
  unresolved(which: number): number
}

/** One occurrence of an expanded page, in tree order. */
export interface CrateOccurrence {
  sourceId: string
  depth: number
  flags: number
}

export interface CrateExpansion {
  occurrences: CrateOccurrence[]
  placements: number
  missingComponents: number
  loops: number
}

export interface CrateDocument {
  /** Page ids in saved order. */
  pageIds: string[]
  expand(page: number): CrateExpansion
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
  const pointer = crate.alloc(file.length)
  new Uint8Array(crate.memory.buffer, pointer, file.length).set(file)
  if (crate.open(pointer, file.length) < 0) {
    const message = new Uint8Array(crate.memory.buffer, crate.error(), crate.error_length())
    throw new Error(new TextDecoder().decode(message))
  }
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
        placements: crate.placements(),
        loops: crate.unresolved(3),
        missingComponents: crate.unresolved(4)
      }
    }
  }
}

type Tree = ReadonlyArray<{ sourceId: string; depth: number }>

/** The TypeScript reader's page tree in the crate's order: ids and depths, depth first. */
function flatten(page: InstanceOccurrence): Tree {
  const occurrences: Array<{ sourceId: string; depth: number }> = []
  const walk = (node: InstanceOccurrence, depth: number): void => {
    occurrences.push({ sourceId: node.sourceId, depth })
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(page, 0)
  return occurrences
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
    // Reported, as an editor load reports them, rather than thrown.
    const ignore = () => undefined
    const read = opened.reader.selectPages(new Set([id])).readPage(id, {
      derivedBounds: true,
      onMissingComponent: () => missingComponents++,
      onUnresolvedProperty: ignore,
      onUnresolvedAssignment: ignore,
      onCyclicComponent: ignore,
      onMissingSlotContent: ignore
    })
    const expansion = crate.expand(page)
    return {
      id,
      difference: firstDifference(expansion.occurrences, flatten(read)),
      missingComponents: { crate: expansion.missingComponents, reader: missingComponents }
    }
  })
  return { pageIds: { crate: crate.pageIds, reader: readerPages }, pages }
}
