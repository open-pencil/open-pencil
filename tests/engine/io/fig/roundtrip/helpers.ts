import type { SceneGraph, SceneNode } from '@open-pencil/core'

import { verifyComponentPropDefs, verifyDerivedTextData } from './raw-verifiers/helpers'

export interface Mismatch {
  path: string
  key: string
  message: string
}

export interface FixtureSpec {
  file: string
  fileSize: number
  nodeCount: number
  nodeTypes: Record<string, number>
  schemaSize: number
  thumbnailSize: number
  thumbnailWidth: number
  thumbnailHeight: number
  imageCount: number
  figKiwiVersion: number
  g1ExportSize: number
  g2ExportSize: number
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
  ]
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
        return aliasB?.guid && JSON.stringify(aliasB.guid) === JSON.stringify(aliasA.guid)
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
      const found = bEntries.find((entryB) => {
        const aliasB = entryB.variableData?.value?.alias
        return (
          aliasB?.assetRef && JSON.stringify(aliasB.assetRef) === JSON.stringify(aliasA.assetRef)
        )
      })
      if (found && found.variableField !== entryA.variableField) {
        ctx.errors.push({
          path: ctx.path,
          key: ctx.key,
          message: `library variable field mismatch: expected ${entryA.variableField}, got ${found.variableField}`
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
        return aliasA?.guid && JSON.stringify(aliasA.guid) === JSON.stringify(aliasB.guid)
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

function verifyVarAlias(a: unknown, b: unknown): boolean {
  const aVal = a as Record<string, unknown> | undefined
  const bVal = b as Record<string, unknown> | undefined
  if (!aVal && !bVal) return true
  if (!aVal || !bVal) return false
  const aAlias = (aVal.value as Record<string, unknown>)?.alias as
    | Record<string, unknown>
    | undefined
  const bAlias = (bVal.value as Record<string, unknown>)?.alias as
    | Record<string, unknown>
    | undefined
  const aGuid = aAlias?.guid
  const bGuid = bAlias?.guid
  const aRef = aAlias?.assetRef
  const bRef = bAlias?.assetRef
  if (aGuid && bGuid) return JSON.stringify(aGuid) === JSON.stringify(bGuid)
  if ((aRef && bGuid) || (aGuid && bRef)) return true
  if (aRef && bRef) return JSON.stringify(aRef) === JSON.stringify(bRef)
  return false
}

/** Verifier that defaults undefined values and compares strictly. */
function defaultEqual(defaultVal: unknown): Verifier {
  return (ctx) => {
    if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
    const aVal = ctx.a === undefined ? defaultVal : ctx.a
    const bVal = ctx.b === undefined ? defaultVal : ctx.b
    return aVal === bVal
  }
}

export const RAW_VERIFIERS = new Map<string, Verifier>([
  [
    'letterSpacing',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      const g1raw = ctx.b as Record<string, unknown> | undefined
      const node = ctx.aNodes.get(ctx.path)
      if (!node || node.fontSize == null) return true
      const expected = node.letterSpacing
      const actual = g1raw?.value as number | undefined
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
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      const g1raw = ctx.b as Record<string, unknown> | undefined
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
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      const ga = ctx.a as
        | {
            entries?: Array<{
              variableData?: { value?: { alias?: { guid?: unknown; assetRef?: unknown } } }
              variableField?: string
            }>
          }
        | undefined
      const gb = ctx.b as
        | {
            entries?: Array<{
              variableData?: { value?: { alias?: { guid?: unknown; assetRef?: unknown } } }
              variableField?: string
            }>
          }
        | undefined
      verifyVariableConsumption(ga, gb, ctx)
      return true
    }
  ],
  [
    'parameterConsumptionMap',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      return true
    }
  ],
  ['borderRightWeight', defaultEqual(0)],
  ['borderLeftWeight', defaultEqual(0)],
  ['borderTopWeight', defaultEqual(0)],
  ['borderBottomWeight', defaultEqual(0)],
  [
    'componentPropDefs',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      return verifyComponentPropDefs(ctx.a, ctx.b)
    }
  ],
  [
    'derivedTextData',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      return verifyDerivedTextData(ctx)
    }
  ],
  ['styleId', defaultEqual(0)],
  [
    'indentationLevel',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      const aVal = ctx.a === undefined ? 0 : ctx.a
      const bVal = ctx.b === undefined ? 0 : ctx.b
      return aVal === bVal
    }
  ],
  [
    'sourceDirectionality',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      const aVal = ctx.a === undefined ? 'AUTO' : ctx.a
      const bVal = ctx.b === undefined ? 'AUTO' : ctx.b
      return aVal === bVal
    }
  ],
  [
    'listStartOffset',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      const aVal = ctx.a === undefined ? 0 : ctx.a
      const bVal = ctx.b === undefined ? 0 : ctx.b
      return aVal === bVal
    }
  ],
  [
    'isFirstLineOfList',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      const aVal = ctx.a === undefined ? false : ctx.a
      const bVal = ctx.b === undefined ? false : ctx.b
      return aVal === bVal
    }
  ],
  [
    'directionality',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      const aVal = ctx.a === undefined ? 'AUTO' : ctx.a
      const bVal = ctx.b === undefined ? 'AUTO' : ctx.b
      return aVal === bVal
    }
  ],
  [
    'directionalityIntent',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      const aVal = ctx.a === undefined ? 'AUTO' : ctx.a
      const bVal = ctx.b === undefined ? 'AUTO' : ctx.b
      return aVal === bVal
    }
  ],
  [
    'fontVersion',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      return ctx.b === '' || ctx.a === ctx.b
    }
  ],
  [
    'postscript',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      return ctx.b === '' || ctx.a === ctx.b
    }
  ],
  ['textExplicitLayoutVersion', defaultEqual(1)],
  [
    'textUserLayoutVersion',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      return (ctx.a === 3 || ctx.a === 4 || ctx.a === 5) && ctx.b === 4
    }
  ],
  [
    'blendMode',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
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
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      return verifyVarAlias(ctx.a, ctx.b)
    }
  ],
  [
    'opacityVar',
    (ctx) => {
      if (isIdempotent(ctx)) return JSON.stringify(ctx.a) === JSON.stringify(ctx.b)
      return verifyVarAlias(ctx.a, ctx.b)
    }
  ]
])
