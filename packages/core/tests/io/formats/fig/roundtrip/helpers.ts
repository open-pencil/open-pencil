import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@open-pencil/core'
import type { ComponentPropertyDefinition } from '@open-pencil/scene-graph'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

import { verifyComponentPropDefs, verifyDerivedTextData } from './raw-verifiers/helpers'

export interface Mismatch {
  path: string
  key: string
  message: string
}

export interface FixtureSpec {
  file: string
  fileSize: number
  schemaSize: number
  thumbnailSize: number
  thumbnailWidth: number
  thumbnailHeight: number
  imageCount: number
  figKiwiVersion: number
}

export interface VerifierContext {
  a: unknown
  b: unknown
  key: string
  path: string
  aNodes: Map<string, SceneNode>
  bNodes: Map<string, SceneNode>
  aGraph: SceneGraph
  bGraph: SceneGraph
  aNodePaths: ReadonlyMap<string, string>
  bNodePaths: ReadonlyMap<string, string>
  aComponentPropertyDefinitions: ReadonlyMap<string, ComponentPropertyDefinition>
  bComponentPropertyDefinitions: ReadonlyMap<string, ComponentPropertyDefinition>
  errors: Mismatch[]
  fixture: FixtureSpec
  label: string
  /** Roundtrip generation: 0 for G0→G1 (allows semantic equivalence), 1 for G1→G2 (requires exact match). */
  generation: number
}

export interface CompareOptions extends Omit<VerifierContext, 'a' | 'b' | 'key' | 'path'> {
  verifiers: Map<string, Verifier>
}

/** G1→G2 must be exactly equal (idempotent export). G0→G1 allows semantic equivalence. */
const isIdempotent = (ctx: VerifierContext): boolean => ctx.generation === 1

export type Verifier = (ctx: VerifierContext) => boolean

export function isColorObj(v: unknown): v is Record<string, number> {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, number>
  return (
    typeof c.r === 'number' &&
    typeof c.g === 'number' &&
    typeof c.b === 'number' &&
    typeof c.a === 'number'
  )
}

export function buildNodePathIndex(nodes: ReadonlyMap<string, SceneNode>): Map<string, string> {
  return new Map([...nodes].map(([path, node]) => [node.id, path]))
}

export function buildComponentPropertyDefinitionIndex(
  graph: SceneGraph
): Map<string, ComponentPropertyDefinition> {
  const definitions = new Map<string, ComponentPropertyDefinition>()
  for (const node of graph.getAllNodes()) {
    for (const definition of node.componentPropertyDefinitions) {
      if (!definitions.has(definition.id)) definitions.set(definition.id, definition)
    }
  }
  return definitions
}

function sameNodeReference(ctx: VerifierContext, a: string, b: string): boolean {
  const aPath = ctx.aNodePaths.get(a)
  const bPath = ctx.bNodePaths.get(b)
  return aPath !== undefined && aPath === bPath
}

function sameNodeReferences(
  ctx: VerifierContext,
  a: string[] | undefined,
  b: string[] | undefined
): boolean {
  if (a === undefined || b === undefined) return a === b
  return (
    a.length === b.length &&
    a.every((value, index) => {
      const other = b[index]
      if (other === undefined) return false
      if (sameNodeReference(ctx, value, other)) return true
      if (ctx.aGraph.getNode(value) || ctx.bGraph.getNode(other)) return false
      // Preferred choices may be retained external asset keys rather than graph nodes.
      // A missing runtime/source GUID must not be accepted as an external asset.
      return !/^\d+:\d+$/.test(value) && value === other
    })
  )
}
function isComponentPropertyDefinitions(value: unknown): value is ComponentPropertyDefinition[] {
  if (!Array.isArray(value)) return false
  return value.every(isComponentPropertyDefinition)
}

function isComponentPropertyDefinition(value: unknown): value is ComponentPropertyDefinition {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ComponentPropertyDefinition>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.type === 'VARIANT' ||
      candidate.type === 'TEXT' ||
      candidate.type === 'BOOLEAN' ||
      candidate.type === 'INSTANCE_SWAP') &&
    typeof candidate.defaultValue === 'string'
  )
}

function verifyComponentPropertyDefinitions(ctx: VerifierContext): boolean {
  if (!isComponentPropertyDefinitions(ctx.a) || !isComponentPropertyDefinitions(ctx.b)) {
    return false
  }
  const aDefinitions = ctx.a
  const bDefinitions = ctx.b
  if (aDefinitions.length !== bDefinitions.length) return false

  return aDefinitions.every((value, index) => {
    const definition = value
    const other = bDefinitions[index]
    if (!other || definition.type !== other.type || definition.name !== other.name) {
      return false
    }

    const { defaultValue, preferredValues, ...rest } = definition
    const {
      defaultValue: otherDefaultValue,
      preferredValues: otherPreferredValues,
      ...otherRest
    } = other
    if (!isEqual(rest, otherRest)) return false

    if (definition.type !== 'INSTANCE_SWAP') return defaultValue === otherDefaultValue
    return (
      typeof defaultValue === 'string' &&
      typeof otherDefaultValue === 'string' &&
      sameNodeReference(ctx, defaultValue, otherDefaultValue) &&
      sameNodeReferences(ctx, preferredValues, otherPreferredValues)
    )
  })
}

function isComponentPropertyAssignments(value: unknown): value is ComponentPropertyAssignments {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'string')
}

function verifyComponentPropertyAssignments(ctx: VerifierContext): boolean {
  if (!isComponentPropertyAssignments(ctx.a) || !isComponentPropertyAssignments(ctx.b)) {
    return false
  }

  const aAssignments = ctx.a
  const bAssignments = ctx.b
  const propertyIds = new Set([...Object.keys(aAssignments), ...Object.keys(bAssignments)])
  for (const propertyId of propertyIds) {
    const a = aAssignments[propertyId]
    const b = bAssignments[propertyId]
    if (a === b) continue
    if (typeof a !== 'string' || typeof b !== 'string') return false
    const aDefinition = ctx.aComponentPropertyDefinitions.get(propertyId)
    const bDefinition = ctx.bComponentPropertyDefinitions.get(propertyId)
    if (aDefinition?.type !== 'INSTANCE_SWAP' || bDefinition?.type !== 'INSTANCE_SWAP') {
      return false
    }
    if (!sameNodeReference(ctx, a, b)) return false
  }
  return true
}

export const SCENE_VERIFIERS = new Map<string, Verifier>([
  [
    'pluginData',
    (ctx) => {
      const ga = ctx.a as Array<{ pluginId: string; key: string; value: string }>
      const gb = ctx.b as Array<{ pluginId: string; key: string; value: string }>
      if (!Array.isArray(ga) || !Array.isArray(gb) || ga.length > gb.length) return false
      for (const e of ga) {
        const found = gb.find((e2) => e2.pluginId === e.pluginId && e2.key === e.key)
        if (!found || found.value !== e.value) return false
      }
      return true
    }
  ],
  [
    'color',
    (ctx) => {
      const { a, b } = ctx
      if (!isColorObj(a) || !isColorObj(b)) return false
      return (
        Math.abs(a.r - b.r) <= 0.005 &&
        Math.abs(a.g - b.g) <= 0.005 &&
        Math.abs(a.b - b.b) <= 0.005 &&
        Math.abs(a.a - b.a) <= 0.005
      )
    }
  ],
  [
    'type',
    (ctx) => {
      if (!ctx.key.includes('componentPropertyDefinitions')) return false
      return ctx.a === 'VARIANT' && ctx.b === 'TEXT'
    }
  ],
  ...(['fillStyleId', 'strokeStyleId', 'textStyleId', 'effectStyleId', 'gridStyleId'] as const).map(
    (field): [string, Verifier] => [
      field,
      (ctx) =>
        typeof ctx.a === 'string' &&
        typeof ctx.b === 'string' &&
        sameNodeReference(ctx, ctx.a, ctx.b)
    ]
  ),
  ['componentPropertyDefinitions', verifyComponentPropertyDefinitions],
  ['componentPropertyAssignments', verifyComponentPropertyAssignments]
])

function verifyAEntries(
  aEntries: Array<{
    variableData?: { value?: { alias?: { guid?: unknown; assetRef?: unknown } } }
    variableField?: string
  }>,
  bEntries: Array<{
    variableData?: { value?: { alias?: { guid?: unknown; assetRef?: unknown } } }
    variableField?: string
  }>,
  ctx: VerifierContext
): void {
  for (const entryA of aEntries) {
    const aliasA = entryA.variableData?.value?.alias
    if (aliasA?.guid) {
      const found = bEntries.find((entryB) => {
        const aliasB = entryB.variableData?.value?.alias
        return aliasB?.guid && isEqual(aliasB.guid, aliasA.guid)
      })
      if (!found) {
        ctx.errors.push({
          path: ctx.path,
          key: ctx.key,
          message: `local variable with guid ${JSON.stringify(aliasA.guid)} not preserved in roundtrip`
        })
      }
    }
    if (aliasA?.assetRef) {
      const matches = bEntries.filter((entryB) => {
        const aliasB = entryB.variableData?.value?.alias
        return aliasB?.assetRef && isEqual(aliasB.assetRef, aliasA.assetRef)
      })
      if (
        matches.length > 0 &&
        !matches.some((entryB) => entryB.variableField === entryA.variableField)
      ) {
        ctx.errors.push({
          path: ctx.path,
          key: ctx.key,
          message: `library variable field missing: ${entryA.variableField}`
        })
      }
    }
  }
}

function verifyBEntries(
  aEntries: Array<{
    variableData?: { value?: { alias?: { guid?: unknown; assetRef?: unknown } } }
    variableField?: string
  }>,
  bEntries: Array<{
    variableData?: { value?: { alias?: { guid?: unknown; assetRef?: unknown } } }
    variableField?: string
  }>,
  ctx: VerifierContext
): void {
  for (const entryB of bEntries) {
    const aliasB = entryB.variableData?.value?.alias
    if (aliasB?.guid) {
      const found = aEntries.find((entryA) => {
        const aliasA = entryA.variableData?.value?.alias
        return aliasA?.guid && isEqual(aliasA.guid, aliasB.guid)
      })
      if (!found) {
        ctx.errors.push({
          path: ctx.path,
          key: ctx.key,
          message: `unexpected local variable with guid ${JSON.stringify(aliasB.guid)} created in roundtrip`
        })
      }
    }
  }
}

function verifyVariableConsumption(
  ga:
    | {
        entries?: Array<{
          variableData?: { value?: { alias?: { guid?: unknown; assetRef?: unknown } } }
          variableField?: string
        }>
      }
    | undefined,
  gb:
    | {
        entries?: Array<{
          variableData?: { value?: { alias?: { guid?: unknown; assetRef?: unknown } } }
          variableField?: string
        }>
      }
    | undefined,
  ctx: VerifierContext
): void {
  const aEntries = ga?.entries ?? []
  const bEntries = gb?.entries ?? []
  verifyAEntries(aEntries, bEntries, ctx)
  verifyBEntries(aEntries, bEntries, ctx)
}

interface VariableConsumptionMapShape {
  entries?: Array<{
    variableData?: { value?: { alias?: { guid?: unknown; assetRef?: unknown } } }
    variableField?: string
  }>
}

function verifyVarAlias(a: unknown, b: unknown): boolean {
  const aVal = a as JSONObject | undefined
  const bVal = b as JSONObject | undefined
  if (!aVal && !bVal) return true
  if (!aVal || !bVal) return false
  const aAlias = (aVal.value as JSONObject)?.alias as JSONObject | undefined
  const bAlias = (bVal.value as JSONObject)?.alias as JSONObject | undefined
  const aGuid = aAlias?.guid
  const bGuid = bAlias?.guid
  const aRef = aAlias?.assetRef
  const bRef = bAlias?.assetRef
  if (aGuid && bGuid) return isEqual(aGuid, bGuid)
  if ((aRef && bGuid) || (aGuid && bRef)) return true
  if (aRef && bRef) return isEqual(aRef, bRef)
  return false
}

/** Verifier that defaults undefined values and compares strictly. */
function defaultEqual(defaultVal: unknown): Verifier {
  return (ctx) => {
    if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
    const aVal = ctx.a === undefined ? defaultVal : ctx.a
    const bVal = ctx.b === undefined ? defaultVal : ctx.b
    return aVal === bVal
  }
}

export const RAW_VERIFIERS = new Map<string, Verifier>([
  [
    'letterSpacing',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const g1raw = ctx.b as JSONObject | undefined
      const node = ctx.aNodes.get(ctx.path)
      if (!node || node.fontSize == null) return true
      const expected = node.letterSpacing
      const value = g1raw?.value
      let actual = typeof value === 'number' ? value : undefined
      if (actual !== undefined && g1raw?.units === 'PERCENT') {
        actual = (actual * node.fontSize) / 100
      }
      if (expected != null && actual != null && Math.abs(expected - actual) > 0.05) {
        ctx.errors.push({
          path: ctx.path,
          key: ctx.key,
          message: `${expected} (scene) vs ${actual} (raw)`
        })
      }
      return true
    }
  ],
  [
    'lineHeight',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const g1raw = ctx.b as JSONObject | undefined
      const node = ctx.aNodes.get(ctx.path)
      if (!node || node.lineHeight == null) return true
      const expected = node.lineHeight
      const actual = g1raw?.value as number | undefined
      return expected == null || actual == null || Number.isFinite(actual)
    }
  ],
  [
    'variableConsumptionMap',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const ga = ctx.a as VariableConsumptionMapShape | undefined
      const gb = ctx.b as VariableConsumptionMapShape | undefined
      verifyVariableConsumption(ga, gb, ctx)
      return true
    }
  ],
  [
    'parameterConsumptionMap',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      return true
    }
  ],
  ['textAlignHorizontal', defaultEqual('LEFT')],
  ['borderRightWeight', defaultEqual(0)],
  ['borderLeftWeight', defaultEqual(0)],
  ['borderTopWeight', defaultEqual(0)],
  ['borderBottomWeight', defaultEqual(0)],
  [
    'componentPropDefs',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      return verifyComponentPropDefs(ctx.a, ctx.b)
    }
  ],
  [
    'derivedTextData',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      return verifyDerivedTextData(ctx)
    }
  ],
  ['styleId', defaultEqual(0)],
  [
    'indentationLevel',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const aVal = ctx.a === undefined ? 0 : ctx.a
      const bVal = ctx.b === undefined ? 0 : ctx.b
      return aVal === bVal
    }
  ],
  [
    'sourceDirectionality',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const aVal = ctx.a === undefined ? 'AUTO' : ctx.a
      const bVal = ctx.b === undefined ? 'AUTO' : ctx.b
      return aVal === bVal
    }
  ],
  [
    'listStartOffset',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const aVal = ctx.a === undefined ? 0 : ctx.a
      const bVal = ctx.b === undefined ? 0 : ctx.b
      return aVal === bVal
    }
  ],
  [
    'isFirstLineOfList',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const aVal = ctx.a === undefined ? false : ctx.a
      const bVal = ctx.b === undefined ? false : ctx.b
      return aVal === bVal
    }
  ],
  [
    'directionality',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const aVal = ctx.a === undefined ? 'AUTO' : ctx.a
      const bVal = ctx.b === undefined ? 'AUTO' : ctx.b
      return aVal === bVal
    }
  ],
  [
    'directionalityIntent',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const aVal = ctx.a === undefined ? 'AUTO' : ctx.a
      const bVal = ctx.b === undefined ? 'AUTO' : ctx.b
      return aVal === bVal
    }
  ],
  [
    'fontVersion',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      return ctx.b === '' || ctx.a === ctx.b
    }
  ],
  [
    'postscript',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      return ctx.b === '' || ctx.a === ctx.b
    }
  ],
  ['textExplicitLayoutVersion', defaultEqual(1)],
  [
    'textUserLayoutVersion',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      return ctx.a === ctx.b || ((ctx.a === 3 || ctx.a === 4 || ctx.a === 5) && ctx.b === 4)
    }
  ],
  [
    'blendMode',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      const aVal = ctx.a === undefined ? 'NORMAL' : ctx.a
      const bVal = ctx.b === undefined ? 'NORMAL' : ctx.b
      return aVal === bVal
    }
  ],
  // colorVar and opacityVar: G0 raw paints use alias.assetRef for library
  // variables; G1 converts these to alias.guid for local resolution. Both
  // reference the same variable — semantically equivalent.
  [
    'colorVar',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      return verifyVarAlias(ctx.a, ctx.b)
    }
  ],
  [
    'opacityVar',
    (ctx) => {
      if (isIdempotent(ctx)) return isEqual(ctx.a, ctx.b)
      return verifyVarAlias(ctx.a, ctx.b)
    }
  ]
])
