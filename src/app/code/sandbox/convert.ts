import { mapValues } from 'es-toolkit'
import * as v from 'valibot'

import {
  defineMode,
  defineVars,
  designJSXHelpers,
  isVariableInput,
  ref as layerRef,
  type DesignMode,
  type DesignVariable,
  type LayerRef,
  type TreeNode,
  type VariableInput
} from '@open-pencil/design-jsx'

import type { DesignJSXHelperDescriptor } from '@/app/code/sandbox/types'

/** The helpers a run's descriptors call, as the string renderer gives them to JSX. */
const HELPERS: Record<string, (...args: never[]) => unknown> = designJSXHelpers([])

type PlainRecord = { [key: string]: unknown }

type SerializedDesignJSXElement = {
  type: string
  props: PlainRecord
  children: unknown[]
  /** The line the transform reports, when the element's source line is known. */
  source?: unknown
}

function sourceLine(value: unknown, lineOffset: number | undefined): number | undefined {
  if (lineOffset === undefined || typeof value !== 'number') return undefined
  return lineOffset + value
}

function isRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSerializedElement(value: unknown): value is SerializedDesignJSXElement {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    isRecord(value.props) &&
    Array.isArray(value.children)
  )
}

function isHelper(value: unknown): value is DesignJSXHelperDescriptor {
  return (
    isRecord(value) && typeof value.__openPencilHelper === 'string' && Array.isArray(value.args)
  )
}

/** A collection as the sandbox's `defineVars` writes it, with the modes `defineMode` added. */
const collectionRecordSchema = v.object({
  collection: v.string(),
  values: v.record(v.string(), v.unknown()),
  options: v.object({ mode: v.optional(v.string()) }),
  modes: v.array(v.object({ mode: v.string(), values: v.record(v.string(), v.unknown()) }))
})

/** One evaluation's handles: each numbered `ref()`, and each collection's variables and modes. */
type Collection = {
  variables: Record<string, DesignVariable>
  modes: Map<string, DesignMode>
}
type Handles = {
  refs: Map<unknown, LayerRef>
  records: unknown[]
  collections: Map<number, Collection>
}

function variableValues(values: Record<string, unknown>, handles: Handles) {
  return mapValues(values, (value, name): VariableInput => {
    const converted = convertValue(value, handles)
    if (!isVariableInput(converted)) throw new Error(`Variable ${name} has an unsupported value.`)
    return converted
  })
}

/**
 * The collection numbered `index`, defined once per evaluation. Its modes are defined after its
 * variables, so a mode can alias the collection's own variables.
 */
function collection(index: unknown, handles: Handles): Collection {
  if (typeof index !== 'number') throw new Error('Unknown variable collection.')
  const known = handles.collections.get(index)
  if (known) return known
  const parsed = v.safeParse(collectionRecordSchema, handles.records[index])
  if (!parsed.success) throw new Error('Unknown variable collection.')
  const record = parsed.output
  const variables = defineVars(
    record.collection,
    variableValues(record.values, handles),
    record.options
  )
  const defined: Collection = { variables, modes: new Map() }
  handles.collections.set(index, defined)
  for (const mode of record.modes) {
    const values = variableValues(mode.values, handles)
    defined.modes.set(mode.mode, defineMode(variables, mode.mode, values))
  }
  return defined
}

function convertValue(value: unknown, handles: Handles): unknown {
  if (isHelper(value)) {
    const helperName = value.__openPencilHelper
    const [first, second] = value.args
    if (helperName === 'ref') {
      const handle = handles.refs.get(first) ?? layerRef()
      handles.refs.set(first, handle)
      return handle
    }
    if (helperName === 'variable') {
      const variable =
        typeof second === 'string' && Object.hasOwn(collection(first, handles).variables, second)
          ? collection(first, handles).variables[second]
          : undefined
      if (!variable) throw new Error('Unknown variable.')
      return variable
    }
    if (helperName === 'mode') {
      const mode = typeof second === 'string' && collection(first, handles).modes.get(second)
      if (!mode) throw new Error('Unknown variable mode.')
      return mode
    }
    if (!Object.hasOwn(HELPERS, helperName))
      throw new TypeError(`Unknown Design JSX helper "${helperName}".`)
    const helper = HELPERS[helperName] as (...args: unknown[]) => unknown
    return helper(...value.args.map((arg) => convertValue(arg, handles)))
  }
  if (Array.isArray(value)) return value.map((item) => convertValue(item, handles))
  if (isRecord(value)) return mapValues(value, (entry) => convertValue(entry, handles))
  return value
}

function convertTree(value: unknown, handles: Handles, lineOffset?: number): TreeNode {
  if (!isSerializedElement(value)) {
    throw new Error('Design JSX must return an OpenPencil element.')
  }
  const children = value.children.map((child): TreeNode | string => {
    if (typeof child === 'string') return child
    if (typeof child === 'number') return String(child)
    return convertTree(child, handles, lineOffset)
  })
  const tree: TreeNode = {
    type: value.type,
    props: convertValue(value.props, handles) as PlainRecord,
    children
  }
  const line = sourceLine(value.source, lineOffset)
  if (line !== undefined) tree.source = { line }
  return tree
}

export function convertDesignJSXRoots(
  values: unknown[],
  lineOffset?: number,
  collections: unknown[] = []
): TreeNode[] {
  // Call validateDesignJSXOutput first; it enforces the depth bound used by this recursion.
  const handles: Handles = { refs: new Map(), records: collections, collections: new Map() }
  return values.map((value) => convertTree(value, handles, lineOffset))
}
