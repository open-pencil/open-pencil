import { guidToString, setVariableColorResolver } from '@open-pencil/fig/node-change'
import type { NodeChange, VariableDataValuesEntry, Color, GUID } from '@open-pencil/kiwi/fig/codec'

export type FigAssetRef = { key: string; version?: string }
export type FigAliasRef = { guid?: GUID; assetRef?: FigAssetRef }

export function figAssetRefKey(assetRef: FigAssetRef): string {
  return assetRef.version ? `${assetRef.key}@${assetRef.version}` : assetRef.key
}

export function buildFigAssetRefMap(
  changeMap: ReadonlyMap<string, NodeChange>
): Map<string, string> {
  const refs = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (typeof nc.key !== 'string') continue
    if (typeof nc.version !== 'string' || !refs.has(nc.key)) refs.set(nc.key, id)
    if (typeof nc.version === 'string')
      refs.set(figAssetRefKey({ key: nc.key, version: nc.version }), id)
    if (typeof nc.userFacingVersion === 'string') {
      refs.set(figAssetRefKey({ key: nc.key, version: nc.userFacingVersion }), id)
    }
  }
  return refs
}

export function resolveFigAliasId(
  alias: FigAliasRef,
  assetRefs: Map<string, string>
): string | undefined {
  if (alias.guid) return guidToString(alias.guid)
  if (!alias.assetRef) return undefined
  return assetRefs.get(figAssetRefKey(alias.assetRef)) ?? assetRefs.get(alias.assetRef.key)
}

function buildVariableColorResolver(
  changeMap: ReadonlyMap<string, NodeChange>,
  assetRefs: Map<string, string>
): (alias: FigAliasRef) => Color | null {
  const varEntries = new Map<string, VariableDataValuesEntry[]>()
  const varSetId = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (nc.type !== 'VARIABLE') continue
    varEntries.set(id, nc.variableDataValues?.entries ?? [])
    const setGuid = nc.variableSetID?.guid ? guidToString(nc.variableSetID.guid) : undefined
    const parentGuid = nc.parentIndex?.guid ? guidToString(nc.parentIndex.guid) : undefined
    if (setGuid) varSetId.set(id, setGuid)
    else if (parentGuid) varSetId.set(id, parentGuid)
  }

  const defaultModes = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (nc.type !== 'VARIABLE_SET') continue
    const modes = nc.variableSetModes ?? []
    if (modes.length > 0) defaultModes.set(id, guidToString(modes[0].id))
  }

  function resolveById(
    id: string,
    preferredModeId: string | undefined,
    depth: number
  ): Color | null {
    if (depth > 10) return null
    const entries = varEntries.get(id)
    if (!entries?.length) return null

    const setId = varSetId.get(id)
    const defaultMode = setId ? defaultModes.get(setId) : undefined
    let entry = preferredModeId
      ? entries.find((candidate) => guidToString(candidate.modeID) === preferredModeId)
      : undefined
    if (!entry && defaultMode)
      entry = entries.find((candidate) => guidToString(candidate.modeID) === defaultMode)
    if (!entry) entry = entries[0]

    const value = entry.variableData.value
    if (!value) return null
    if (value.colorValue) return value.colorValue
    if (value.alias) {
      const aliasId = resolveFigAliasId(value.alias, assetRefs)
      if (aliasId) return resolveById(aliasId, guidToString(entry.modeID), depth + 1)
    }
    return null
  }

  return (alias) => {
    const id = resolveFigAliasId(alias, assetRefs)
    return id ? resolveById(id, undefined, 0) : null
  }
}

export function withFigVariableColorResolver<T>(
  changeMap: ReadonlyMap<string, NodeChange>,
  callback: (assetRefs: Map<string, string>) => T
): T {
  const assetRefs = buildFigAssetRefMap(changeMap)
  setVariableColorResolver(buildVariableColorResolver(changeMap, assetRefs))
  try {
    return callback(assetRefs)
  } finally {
    setVariableColorResolver(null)
  }
}
