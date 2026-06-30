import type { GUID } from '@open-pencil/kiwi/fig/codec'

import type { OverridePatch } from '#core/kiwi/fig/instance-overrides/patches'
import type {
  OverrideContext,
  SymbolOverride,
  SymbolOverrideFields
} from '#core/kiwi/fig/instance-overrides/types'
import { guidToString, VARIABLE_BINDING_FIELDS_INVERSE } from '#core/kiwi/fig/node-change/convert'
import { applyStyleRefsToFields } from '#core/kiwi/fig/node-change/style-refs'

import { convertOverrideToProps } from './props'

interface AliasRef {
  guid?: GUID
  assetRef?: { key: string; version?: string }
}

const VARIABLE_RADIUS_FIELDS = new Set([
  'RECTANGLE_TOP_LEFT_CORNER_RADIUS',
  'RECTANGLE_TOP_RIGHT_CORNER_RADIUS',
  'RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS',
  'RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS'
])

function assetRefKey(assetRef: { key: string; version?: string }): string {
  return assetRef.version ? `${assetRef.key}@${assetRef.version}` : assetRef.key
}

function buildAssetRefMap(ctx: OverrideContext): Map<string, string> {
  const refs = new Map<string, string>()
  for (const [id, nc] of ctx.changeMap) {
    const key = typeof nc.key === 'string' ? nc.key : undefined
    if (!key) continue
    refs.set(key, id)
    const version = typeof nc.version === 'string' ? nc.version : undefined
    if (version) refs.set(assetRefKey({ key, version }), id)
  }
  return refs
}

function resolveAliasId(alias: AliasRef, assetRefs: Map<string, string>): string | undefined {
  if (alias.guid) return guidToString(alias.guid)
  const assetRef = alias.assetRef
  if (!assetRef?.key) return undefined
  return assetRefs.get(assetRefKey(assetRef)) ?? assetRefs.get(assetRef.key)
}

function resolveFloatVariable(
  ctx: OverrideContext,
  id: string,
  assetRefs: Map<string, string>,
  depth = 0
): number | undefined {
  if (depth > 10) return undefined
  const nc = ctx.changeMap.get(id)
  const entry = nc?.variableDataValues?.entries?.[0]
  if (!entry) return undefined
  const value = entry.variableData.value
  if (!value) return undefined
  if (typeof value.floatValue === 'number') return value.floatValue
  const alias = value.alias as AliasRef | undefined
  const aliasId = alias ? resolveAliasId(alias, assetRefs) : undefined
  return aliasId ? resolveFloatVariable(ctx, aliasId, assetRefs, depth + 1) : undefined
}

function applyVariableRadiusOverrides(
  ctx: OverrideContext,
  fields: SymbolOverrideFields,
  props: ReturnType<typeof convertOverrideToProps>
): void {
  const entries = fields.variableConsumptionMap?.entries
  if (!entries?.length) return
  const assetRefs = buildAssetRefMap(ctx)
  for (const entry of entries) {
    const variableField = entry.variableField
    if (!variableField || !VARIABLE_RADIUS_FIELDS.has(variableField)) continue
    const alias = entry.variableData?.value?.alias
    const id = alias ? resolveAliasId(alias, assetRefs) : undefined
    const value = id ? resolveFloatVariable(ctx, id, assetRefs) : undefined
    if (typeof value !== 'number') continue
    const field = VARIABLE_BINDING_FIELDS_INVERSE[variableField]
    if (field === 'topLeftRadius') props.topLeftRadius = value
    else if (field === 'topRightRadius') props.topRightRadius = value
    else if (field === 'bottomRightRadius') props.bottomRightRadius = value
    else if (field === 'bottomLeftRadius') props.bottomLeftRadius = value
  }
}

export function patchFromSymbolOverride(
  ctx: OverrideContext,
  targetId: string,
  ov: SymbolOverride
): OverridePatch | null {
  const patch: OverridePatch = { targetId, source: 'symbol-override' }
  if (ov.overriddenSymbolID) {
    const swapGuid = guidToString(ov.overriddenSymbolID)
    patch.swapComponentId = ctx.guidToNodeId.get(swapGuid)
  }

  const fields: SymbolOverrideFields = { ...ov }
  delete fields.guidPath
  delete fields.overriddenSymbolID
  delete fields.componentPropAssignments
  if (Object.keys(fields).length > 0) {
    applyStyleRefsToFields(ctx.changeMap, fields)
    const props = convertOverrideToProps(fields)
    applyVariableRadiusOverrides(ctx, fields, props)
    if (Object.keys(props).length > 0) patch.props = props
  }

  return patch.swapComponentId || patch.props ? patch : null
}
