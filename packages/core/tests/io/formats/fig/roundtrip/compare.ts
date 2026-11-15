import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

import {
  type Mismatch,
  type FixtureSpec,
  type CompareOptions,
  type Verifier,
  buildComponentPropertyDefinitionIndex,
  buildNodePathIndex,
  isColorObj,
  SCENE_VERIFIERS,
  RAW_VERIFIERS
} from './helpers'

const SKIP_KEYS = new Set(['id', 'parentId', 'childIds', 'componentId'])

function num3(n: number): string {
  return (Math.round(n * 1e4) / 1e4).toFixed(4)
}

const EPSILON = 0.01
const MAX_ERRORS = 2000
/** Every layer of a document by its index path from its page. */
export function buildPathMap(graph: SceneGraph): Map<string, SceneNode> {
  const map = new Map<string, SceneNode>()
  function walk(parentId: string, parentPath: string) {
    const children = graph.getChildren(parentId)
    for (let i = 0; i < children.length; i++) {
      const childPath = `${parentPath}/${i}`
      map.set(childPath, children[i])
      walk(children[i].id, childPath)
    }
  }
  for (const [p, page] of graph.getPages(true).entries()) {
    walk(page.id, `${p}`)
  }
  return map
}

/** `SceneNode` has no index signature; the generic comparison reads its fields by name. */
const nodeFields = (node: SceneNode): Map<string, unknown> => new Map(Object.entries(node))

// oxlint-disable-next-line complexity
function deepCompare(
  a: unknown,
  b: unknown,
  key: string,
  path: string,
  opts: CompareOptions,
  depth = 0
): void {
  if (opts.errors.length >= MAX_ERRORS || depth > 20) return
  if (a === b) return
  if (a == null && b == null) return

  const leafKey = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key
  const vfn = opts.verifiers.get(key) ?? opts.verifiers.get(leafKey)
  if (vfn) {
    if (vfn({ a, b, key, path, ...opts })) return
    if (isColorObj(a) && isColorObj(b)) {
      opts.errors.push({
        path,
        key,
        message: `color(${num3(a.r)},${num3(a.g)},${num3(a.b)},${num3(a.a)}) -> color(${num3(b.r)},${num3(b.g)},${num3(b.b)},${num3(b.a)})`
      })
    } else {
      opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    }
    return
  }

  if (a == null || b == null) {
    opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    return
  }

  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) {
      opts.errors.push({ path, key, message: `bytes ${a.length} -> ${b.length}` })
      return
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        opts.errors.push({ path, key, message: `byte[${i}] differs (${a.length}B)` })
        return
      }
    }
    return
  }

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return
    if (Math.abs(a - b) > EPSILON) {
      opts.errors.push({ path, key, message: `${a} -> ${b} (D${+(b - a).toPrecision(4)})` })
    }
    return
  }

  if (typeof a !== 'object' || typeof b !== 'object') {
    if (a !== b) opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    return
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    opts.errors.push({ path, key, message: `kind mismatch` })
    return
  }

  if (Array.isArray(a)) {
    const ba = b as unknown[]
    if (a.length !== ba.length) {
      opts.errors.push({ path, key, message: `len ${a.length} -> ${ba.length}` })
      return
    }
    for (let i = 0; i < a.length; i++) {
      deepCompare(a[i], ba[i], `${key}[${i}]`, path, opts, depth + 1)
    }
    return
  }

  const allKeys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
  for (const k of allKeys) {
    if (depth === 0 && SKIP_KEYS.has(k)) continue
    deepCompare(
      (a as JSONObject)[k],
      (b as JSONObject)[k],
      key ? `${key}.${k}` : k,
      path,
      opts,
      depth + 1
    )
  }
}

function fmt(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  if (typeof v === 'string') return v.length > 50 ? `"${v.slice(0, 50)}..."` : `"${v}"`
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Uint8Array) return `bytes[${v.length}]`
  if (Array.isArray(v)) return `[${v.length}]`
  return 'Object'
}

function summarize(errors: Mismatch[]): string {
  const buckets = new Map<string, string[]>()
  for (const err of errors) {
    const signature = `${err.key}: ${err.message}`
    let list = buckets.get(signature)
    if (!list) {
      list = []
      buckets.set(signature, list)
    }
    list.push(err.path)
  }

  const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)

  let out = `Found ${errors.length} mismatches across ${buckets.size} variants:\n\n`
  for (const [sig, paths] of sorted.slice(0, 20)) {
    out += `[${paths.length}x] ${sig}\n`
    out += `  Paths: ${paths.slice(0, 5).join(', ')}${paths.length > 5 ? ' ...' : ''}\n\n`
  }
  return out.trim()
}

/** One generation of a document compared with the next, both by index path. */
export interface Generations {
  fixture: FixtureSpec
  aGraph: SceneGraph
  bGraph: SceneGraph
  aNodes: Map<string, SceneNode>
  bNodes: Map<string, SceneNode>
  label: string
}

function compareOptions(
  { fixture, aGraph, bGraph, aNodes, bNodes, label }: Generations,
  verifiers: Map<string, Verifier>
): CompareOptions {
  return {
    aNodes,
    bNodes,
    aGraph,
    bGraph,
    aNodePaths: buildNodePathIndex(aNodes),
    bNodePaths: buildNodePathIndex(bNodes),
    aComponentPropertyDefinitions: buildComponentPropertyDefinitionIndex(aGraph),
    bComponentPropertyDefinitions: buildComponentPropertyDefinitionIndex(bGraph),
    errors: [],
    fixture,
    verifiers,
    label,
    generation: label.startsWith('G1') ? 1 : 0
  }
}

/** Throws with a summary of every scene property that differs between the generations. */
export function compareSceneProps(
  generations: Generations,
  verifiers: Map<string, Verifier> = SCENE_VERIFIERS
): void {
  const { aNodes, bNodes, label } = generations
  const opts = compareOptions(generations, verifiers)
  const { errors } = opts

  for (const [p, aNode] of aNodes) {
    const bNode = bNodes.get(p)
    if (!bNode) continue
    const aFields = nodeFields(aNode)
    const bFields = nodeFields(bNode)
    for (const k of new Set([...aFields.keys(), ...bFields.keys()])) {
      if (SKIP_KEYS.has(k)) continue
      if (k === 'source') continue
      deepCompare(aFields.get(k), bFields.get(k), k, p, opts)
    }
  }
  if (errors.length > 0) throw new Error(`${label} scene props:\n${summarize(errors)}`)
}

/** Throws with a summary of every saved raw field that differs between the generations. */
export function compareRawNodeFields(
  generations: Generations,
  verifiers: Map<string, Verifier> = RAW_VERIFIERS
): void {
  const { aNodes, bNodes, label } = generations
  const opts = compareOptions(generations, verifiers)
  const { errors } = opts

  for (const [p, aNode] of aNodes) {
    const bNode = bNodes.get(p)
    if (!bNode) continue
    const aRaw = nodeFields(aNode).get('source') as JSONObject | undefined
    const bRaw = nodeFields(bNode).get('source') as JSONObject | undefined
    const aFig = aRaw?.fig as JSONObject | undefined
    const bFig = bRaw?.fig as JSONObject | undefined
    const aFields = aFig?.rawNodeFields as JSONObject | undefined
    const bFields = bFig?.rawNodeFields as JSONObject | undefined
    if (!aFields && !bFields) continue
    deepCompareRaw(aFields, bFields, '', p, opts)
  }
  if (errors.length > 0) throw new Error(`${label} rawNodeFields:\n${summarize(errors)}`)
}

// oxlint-disable-next-line complexity
function deepCompareRaw(
  a: unknown,
  b: unknown,
  key: string,
  path: string,
  opts: CompareOptions,
  depth = 0
): void {
  if (opts.errors.length >= MAX_ERRORS || depth > 20) return
  if (a === b) return
  if (a == null && b == null) return

  if (typeof key === 'string' && key !== '') {
    const leafKey = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key
    const vfn = opts.verifiers.get(key) ?? opts.verifiers.get(leafKey)
    if (vfn) {
      if (vfn({ a, b, key, path, ...opts })) return
    }
  }

  if (
    key === '' &&
    typeof a === 'object' &&
    a !== null &&
    typeof b === 'object' &&
    b !== null &&
    !Array.isArray(a)
  ) {
    const aObj = a as JSONObject
    const bObj = b as JSONObject
    const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
    for (const k of allKeys) {
      const vfn2 = opts.verifiers.get(k)
      if (vfn2) {
        if (!vfn2({ a: aObj[k], b: bObj[k], key: k, path, ...opts })) {
          opts.errors.push({
            path,
            key: k,
            message: `verifier rejected (${fmt(aObj[k])} -> ${fmt(bObj[k])})`
          })
        }
      } else {
        deepCompareRaw(aObj[k], bObj[k], k, path, opts, depth + 1)
      }
    }
    return
  }

  if (a == null || b == null) {
    opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    return
  }

  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) {
      opts.errors.push({ path, key, message: `bytes ${a.length} -> ${b.length}` })
      return
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        opts.errors.push({ path, key, message: `byte[${i}]` })
        return
      }
    }
    return
  }

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return
    if (Math.abs(a - b) > EPSILON) opts.errors.push({ path, key, message: `${a} -> ${b}` })
    return
  }

  if (typeof a !== 'object' || typeof b !== 'object') {
    if (a !== b) opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    return
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    opts.errors.push({ path, key, message: `kind` })
    return
  }

  if (Array.isArray(a)) {
    const ba = b as unknown[]
    if (a.length !== ba.length) {
      opts.errors.push({ path, key, message: `len ${a.length}->${ba.length}` })
      return
    }
    for (let i = 0; i < a.length; i++) {
      deepCompareRaw(a[i], ba[i], `${key}[${i}]`, path, opts, depth + 1)
    }
    return
  }

  const aObj = a as JSONObject
  const bObj = b as JSONObject
  const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
  for (const k of allKeys) {
    const fullKey = key ? `${key}.${k}` : k
    const vfn2 = opts.verifiers.get(fullKey) ?? opts.verifiers.get(k)
    if (vfn2) {
      if (!vfn2({ a: aObj[k], b: bObj[k], key: fullKey, path, ...opts })) {
        opts.errors.push({
          path,
          key: fullKey,
          message: `verifier rejected (${fmt(aObj[k])} -> ${fmt(bObj[k])})`
        })
      }
    } else {
      deepCompareRaw(aObj[k], bObj[k], fullKey, path, opts, depth + 1)
    }
  }
}
