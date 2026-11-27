import type { AssetRef, CodeComponentId, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { forEachOverrideRecord } from '../instance-overrides/types'
import { vectorStyleTable } from './style-dependencies'

interface ShaderPaint {
  type?: string
  customEffectId?: CodeComponentId
}

/**
 * Visit every shader paint and effect a record names: its own, its overrides', and those its text
 * ranges and vector regions name in their style tables.
 */
function forEachShaderPaint(node: NodeChange, visit: (paint: ShaderPaint) => void): void {
  forEachOverrideRecord(node, (source) => {
    for (const record of [
      source,
      ...(source.textData?.styleOverrideTable ?? []),
      ...vectorStyleTable(source)
    ]) {
      const paints: ShaderPaint[] = [
        ...(record.fillPaints ?? []),
        ...(record.strokePaints ?? []),
        ...(record.effects ?? [])
      ]
      for (const paint of paints) if (paint.type === 'CUSTOM' && paint.customEffectId) visit(paint)
    }
  })
}

/** Include the shader definitions a record's shader paints and effects name. */
export function shaderDependencies(
  node: NodeChange,
  resolve: (reference: CodeComponentId) => string | undefined,
  available: ReadonlySet<string>
): Set<string> {
  const result = new Set<string>()
  forEachShaderPaint(node, (paint) => {
    const id = paint.customEffectId ? resolve(paint.customEffectId) : undefined
    if (id && available.has(id)) result.add(id)
  })
  return result
}

/**
 * Leave out the shader definitions a destination already holds, since one key and version names
 * one definition in a file. A paint that named a left-out definition by its GUID names it by key
 * and version instead, which finds the destination's definition.
 */
export function withoutHeldShaderDefinitions(
  changes: NodeChange[],
  holds: (asset: AssetRef) => boolean
): NodeChange[] {
  const dropped = new Map<string, AssetRef>()
  for (const change of changes) {
    if (change.type !== 'CODE_COMPONENT' || !change.guid || typeof change.key !== 'string') continue
    const asset: AssetRef = {
      key: change.key,
      ...(typeof change.version === 'string' ? { version: change.version } : {})
    }
    if (holds(asset)) dropped.set(guidToString(change.guid), asset)
  }
  if (dropped.size === 0) return changes
  for (const change of changes) {
    forEachShaderPaint(change, (paint) => {
      const guid = paint.customEffectId?.guid
      const asset = guid ? dropped.get(guidToString(guid)) : undefined
      if (asset) paint.customEffectId = { assetRef: { ...asset } }
    })
  }
  return changes.filter((change) => !change.guid || !dropped.has(guidToString(change.guid)))
}
