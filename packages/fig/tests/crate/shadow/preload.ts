// Shadow mode: every read the fig tests make through the TypeScript reader is made again by the
// Rust crate and compared, layer tree and every field, while the tests run as usual. The preload
// wraps the reader's entry points, keeps what each read was given, and compares those reads
// after each test, so a difference never changes a test's own result. `run.ts` runs the suite
// with it and reports.
import { afterAll, afterEach, spyOn } from 'bun:test'

import { compareLayers, LENIENT, openWithCrate } from '#fig-tests/helpers/fig-crate'
import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import * as readModule from '#fig/document/read'
import * as interpretModule from '#fig/instance-overrides/interpret'
import type { InstanceOccurrence } from '#fig/instance-overrides/occurrence/types'
import { symbolOverridesOf } from '#fig/instance-overrides/types'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

/** What a read was given: records, or a `.fig` file's bytes. */
type Input = { records: NodeChange[] } | { file: Uint8Array }

type Kind = 'page' | 'component' | 'instance'

interface Read {
  input: Input
  kind: Kind
  id: string
  /** The test line that made the read. */
  at: string
}

export interface ShadowResult {
  kind: Kind
  id: string
  at: string
  /**
   * `loops` for a read that differs where the reader repairs a component loop, which the crate
   * does not port yet.
   */
  outcome: 'same' | 'different' | 'loops' | 'skipped'
  /** For a difference, what differs; for a skipped read, why it could not be compared. */
  detail?: string
  values?: number
}

// The modules' own functions, kept before the spies below replace them where they are imported.
const read = { ...readModule }
const interpret = { ...interpretModule }

const pending: Read[] = []
const results: ShadowResult[] = []

/** The test file and line a read came from; reads the crate's own tests make are not shadowed. */
function caller(): string | undefined {
  const lines = new Error('The read a test made').stack?.split('\n') ?? []
  const test = lines.find(
    (line) =>
      line.includes('/tests/') && !line.includes('/tests/helpers/') && !line.includes('/shadow/')
  )
  if (!test || test.includes('/tests/crate/')) return undefined
  return test
    .trim()
    .replace(/^at (.*\()?/, '')
    .replace(/\)$/, '')
}

function capture(input: () => Input, kind: Kind, id: string): void {
  const at = caller()
  if (!at) return
  try {
    pending.push({ input: input(), kind, id, at })
  } catch (cause) {
    results.push({ kind, id, at, outcome: 'skipped', detail: `input: ${String(cause)}` })
  }
}

const snapshot = (records: readonly NodeChange[]) => () => ({
  records: structuredClone([...records])
})

type Interpreter = ReturnType<typeof interpret.createOccurrenceInterpreter>

function shadowInterpreter(interpreter: Interpreter, records: readonly NodeChange[]): Interpreter {
  const input = snapshot(records)
  const shadowed =
    (kind: Kind): Interpreter[Kind] =>
    (id, options) => {
      capture(input, kind, id)
      return interpreter[kind](id, options)
    }
  return {
    instance: shadowed('instance'),
    component: shadowed('component'),
    page: shadowed('page')
  }
}

type Reader = ReturnType<typeof read.createDocumentReader>

/** A reader whose page and component reads are kept, as are those of readers it selects. */
function shadowReader(reader: Reader, input: () => Input): Reader {
  return new Proxy(reader, {
    get(target, property, receiver) {
      if (property === 'readPage')
        return (id: string, options?: Parameters<Reader['readPage']>[1]) => {
          capture(input, 'page', id)
          return target.readPage(id, options)
        }
      if (property === 'readComponent')
        return (id: string, options?: Parameters<Reader['readComponent']>[1]) => {
          capture(input, 'component', id)
          return target.readComponent(id, options)
        }
      if (property === 'selectPages' || property === 'selectComponents')
        return (selection: never) => shadowReader(target[property](selection), input)
      return Reflect.get(target, property, receiver)
    }
  })
}

spyOn(interpretModule, 'interpretInstance').mockImplementation((changes, id, options) => {
  capture(snapshot(changes), 'instance', id)
  return interpret.interpretInstance(changes, id, options)
})
spyOn(interpretModule, 'interpretComponent').mockImplementation((changes, id, options) => {
  capture(snapshot(changes), 'component', id)
  return interpret.interpretComponent(changes, id, options)
})
spyOn(interpretModule, 'createOccurrenceInterpreter').mockImplementation((changes) =>
  shadowInterpreter(interpret.createOccurrenceInterpreter(changes), changes)
)
spyOn(readModule, 'createDocumentReader').mockImplementation((source, pageIds) =>
  shadowReader(read.createDocumentReader(source, pageIds), snapshot(source))
)
spyOn(readModule, 'createArchiveDocumentReader').mockImplementation((bytes, pageIds) => {
  const opened = read.createArchiveDocumentReader(bytes, pageIds)
  const file = new Uint8Array(bytes.slice(0))
  return { ...opened, reader: shadowReader(opened.reader, () => ({ file })) }
})

/**
 * The read as the TypeScript reader makes it of the file both readers are given: the one read, or
 * one holding the records read, so records that do not survive encoding read the same in both.
 */
function readerRead(
  file: Uint8Array,
  kind: Kind,
  id: string
): { read: InstanceOccurrence; loops: boolean } {
  const { reader } = read.createArchiveDocumentReader(new Uint8Array(file).buffer, new Set())
  let cyclic = 0
  const options = { ...LENIENT, onCyclicComponent: () => void cyclic++ }
  const reads: Record<Kind, () => InstanceOccurrence> = {
    page: () => reader.selectPages(new Set([id])).readPage(id, options),
    component: () => reader.readComponent(id, options),
    instance: () =>
      interpret.createOccurrenceInterpreter(reader.sourceRecords).instance(id, options)
  }
  const occurrence = reads[kind]()
  return { read: occurrence, loops: cyclic > 0 || reader.droppedRecords().size > 0 }
}

/**
 * Records as a saved file holds them: a layer bound to a component property through a legacy
 * `componentPropRefs` entry, as tests often write it, binds it in its parameter map, the only
 * place the document reader and Figma read bindings from.
 */
function asSaved(records: NodeChange[]): NodeChange[] {
  const bind = (node: NodeChange): void => {
    const references = (node.componentPropRefs ?? []) as Array<{
      defID?: GUID
      componentPropNodeField?: string
      isDeleted?: boolean
    }>
    const entries = node.parameterConsumptionMap?.entries ?? []
    for (const { defID, componentPropNodeField: field, isDeleted } of references) {
      if (!defID || !field || isDeleted) continue
      if (entries.some((entry) => entry.variableField === field)) continue
      entries.push({
        variableField: field,
        variableData: { dataType: 'PROP_REF', value: { propRefValue: { defId: defID } } }
      })
    }
    if (entries.length) node.parameterConsumptionMap = { entries }
    for (const entry of symbolOverridesOf(node)) bind(entry as NodeChange)
  }
  records.forEach(bind)
  return records
}

async function compare({ kind, id, at, input }: Read): Promise<ShadowResult> {
  const result = (outcome: ShadowResult['outcome'], detail?: string, values?: number) => ({
    kind,
    id,
    at,
    outcome,
    detail,
    values
  })
  let file: Uint8Array
  try {
    file = 'file' in input ? input.file : new Uint8Array(await figArchiveOf(asSaved(input.records)))
  } catch (cause) {
    return result('skipped', `encoding: ${String(cause)}`)
  }
  let expected: { read: InstanceOccurrence; loops: boolean }
  try {
    expected = readerRead(file, kind, id)
  } catch (cause) {
    return result('skipped', `reader: ${String(cause)}`)
  }
  try {
    const crate = await openWithCrate(file)
    const root = kind === 'page' ? crate.pageIds.indexOf(id) : id
    if (root === -1) return result('different', `the crate has no page ${id}`)
    const { values, differences } = compareLayers(expected.read, crate, root)
    if (!differences.length) return result('same', undefined, values)
    const loops = expected.loops || crate.expand(root).loops > 0
    return result(loops ? 'loops' : 'different', differences.join('\n'), values)
  } catch (cause) {
    return result('different', `crate: ${String(cause)}`)
  }
}

afterEach(async () => {
  for (const shadowed of pending.splice(0)) results.push(await compare(shadowed))
})

afterAll(async () => {
  const report = process.env.FIG_SHADOW_REPORT
  if (report) await Bun.write(report, JSON.stringify(results))
})
