import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString, isUnsetGuid } from '@open-pencil/kiwi/fig/guid'

import { referencedStyle, textStyleValues, type StyleChangeMap } from './lookup'

type StyleRefFields = NodeChange

export function applyFillStyleRef(
  changeMap: StyleChangeMap,
  fields: StyleRefFields,
  assetRefs?: ReadonlyMap<string, string>
): void {
  const fillStyle = referencedStyle(changeMap, fields.styleIdForFill, assetRefs)
  if (fillStyle?.styleType === 'FILL' && fillStyle.fillPaints) {
    fields.fillPaints = fillStyle.fillPaints
  }
}

function applyStrokeStyleRef(
  changeMap: StyleChangeMap,
  fields: StyleRefFields,
  assetRefs?: ReadonlyMap<string, string>
): void {
  const strokeStyle = referencedStyle(changeMap, fields.styleIdForStrokeFill, assetRefs)
  if (strokeStyle?.styleType === 'FILL' && strokeStyle.fillPaints) {
    fields.strokePaints = strokeStyle.fillPaints
  }
}

function applyEffectAndGridStyleRefs(
  changeMap: StyleChangeMap,
  fields: StyleRefFields,
  assetRefs?: ReadonlyMap<string, string>
): void {
  const effectStyle = referencedStyle(changeMap, fields.styleIdForEffect, assetRefs)
  if (effectStyle?.styleType === 'EFFECT' && effectStyle.effects)
    fields.effects = effectStyle.effects
  const gridStyle = referencedStyle(changeMap, fields.styleIdForGrid, assetRefs)
  if (gridStyle?.styleType === 'GRID' && gridStyle.layoutGrids) {
    fields.layoutGrids = gridStyle.layoutGrids
  }
}

function applyTextStyleRef(
  changeMap: StyleChangeMap,
  fields: StyleRefFields,
  assetRefs?: ReadonlyMap<string, string>
): void {
  const style = referencedStyle(changeMap, fields.styleIdForText, assetRefs)
  if (style?.type !== 'TEXT' || style.styleType !== 'TEXT') return
  Object.assign(fields, textStyleValues(style))
}

export function applyStyleRefsToFields(
  changeMap: StyleChangeMap,
  fields: StyleRefFields,
  assetRefs?: ReadonlyMap<string, string>
): void {
  applyFillStyleRef(changeMap, fields, assetRefs)
  applyStrokeStyleRef(changeMap, fields, assetRefs)
  applyEffectAndGridStyleRefs(changeMap, fields, assetRefs)
  applyTextStyleRef(changeMap, fields, assetRefs)
}

/** A style reference's ID, or `null` for none and for the unset GUID, which clears one. */
export function styleRefId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('guid' in value)) return null
  const guid = value.guid
  if (!guid || typeof guid !== 'object') return null
  if (isUnsetGuid(guid as GUID)) return null
  return guidToString(guid as GUID)
}
