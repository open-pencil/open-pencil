import type { JsonObject } from '@open-pencil/scene-graph/primitives'

import type { VerifierContext } from '../helpers'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined
}

function verifyFontDigest(
  amDigest: unknown,
  bmDigest: unknown,
  i: number,
  ctx: VerifierContext
): void {
  if (amDigest && bmDigest) {
    const amHex =
      typeof amDigest === 'string' ? amDigest : Buffer.from(amDigest as Uint8Array).toString('hex')
    const bmHex =
      typeof bmDigest === 'string' ? bmDigest : Buffer.from(bmDigest as Uint8Array).toString('hex')
    if (amHex !== bmHex) {
      ctx.errors.push({
        path: ctx.path,
        key: `${ctx.key}.fontMetaData[${i}].fontDigest`,
        message: `mismatch`
      })
    }
  }
}

function verifyFontLineHeight(amLH: unknown, bmLH: unknown, i: number, ctx: VerifierContext): void {
  const amLineHeight = typeof amLH === 'number' ? amLH : 1.2
  const bmLineHeight = typeof bmLH === 'number' ? bmLH : 1.2
  if (bmLineHeight !== 1.2 && Math.abs(amLineHeight - bmLineHeight) > 0.05) {
    ctx.errors.push({
      path: ctx.path,
      key: `${ctx.key}.fontMetaData[${i}].fontLineHeight`,
      message: `${amLineHeight} vs ${bmLineHeight}`
    })
  }
}

function verifySingleFontMetadata(
  am: Record<string, unknown>,
  bm: Record<string, unknown>,
  i: number,
  ctx: VerifierContext
): void {
  const amKey = am.key as JsonObject | undefined
  const bmKey = bm.key as JsonObject | undefined
  if (amKey?.family !== bmKey?.family) {
    ctx.errors.push({
      path: ctx.path,
      key: `${ctx.key}.fontMetaData[${i}].key.family`,
      message: `${String(amKey?.family)} vs ${String(bmKey?.family)}`
    })
  }
  if (amKey?.style !== bmKey?.style) {
    ctx.errors.push({
      path: ctx.path,
      key: `${ctx.key}.fontMetaData[${i}].key.style`,
      message: `${String(amKey?.style)} vs ${String(bmKey?.style)}`
    })
  }
  if (am.fontWeight !== bm.fontWeight) {
    ctx.errors.push({
      path: ctx.path,
      key: `${ctx.key}.fontMetaData[${i}].fontWeight`,
      message: `${String(am.fontWeight)} vs ${String(bm.fontWeight)}`
    })
  }
  if (am.fontStyle !== bm.fontStyle) {
    ctx.errors.push({
      path: ctx.path,
      key: `${ctx.key}.fontMetaData[${i}].fontStyle`,
      message: `${String(am.fontStyle)} vs ${String(bm.fontStyle)}`
    })
  }
  verifyFontLineHeight(am.fontLineHeight, bm.fontLineHeight, i, ctx)
  verifyFontDigest(am.fontDigest, bm.fontDigest, i, ctx)
}

function verifyFontMetadata(aMeta: JsonObject[], bMeta: JsonObject[], ctx: VerifierContext): void {
  for (let i = 0; i < aMeta.length; i++) {
    verifySingleFontMetadata(aMeta[i], bMeta[i], i, ctx)
  }
}

function verifyVectorSize(
  aSize: unknown,
  bSize: unknown,
  key: string,
  ctx: VerifierContext,
  tolerance = 1
): void {
  const aVec = asRecord(aSize)
  const bVec = asRecord(bSize)
  for (const axis of ['x', 'y']) {
    const aValue = aVec?.[axis]
    const bValue = bVec?.[axis]
    if (typeof aValue !== 'number' || typeof bValue !== 'number') continue
    if (Math.abs(aValue - bValue) > tolerance) {
      ctx.errors.push({
        path: ctx.path,
        key: `${ctx.key}.${key}.${axis}`,
        message: `${aValue} vs ${bValue}`
      })
    }
  }
}

export function verifyDerivedTextData(ctx: VerifierContext): boolean {
  const aVal = asRecord(ctx.a)
  const bVal = asRecord(ctx.b)
  if (!aVal && !bVal) return true
  if (!aVal || !bVal) return false

  verifyVectorSize(aVal.layoutSize, bVal.layoutSize, 'layoutSize', ctx)

  for (const key of ['truncationStartIndex', 'truncatedHeight']) {
    if (aVal[key] !== bVal[key]) {
      ctx.errors.push({
        path: ctx.path,
        key: `${ctx.key}.${key}`,
        message: `${String(aVal[key])} vs ${String(bVal[key])}`
      })
    }
  }

  const aGlyphs = (aVal.glyphs as unknown[] | undefined) ?? []
  const bGlyphs = (bVal.glyphs as unknown[] | undefined) ?? []
  if (aGlyphs.length !== bGlyphs.length) {
    ctx.errors.push({
      path: ctx.path,
      key: `${ctx.key}.glyphs`,
      message: `length mismatch: ${aGlyphs.length} vs ${bGlyphs.length}`
    })
  }

  const aMeta = (aVal.fontMetaData as JsonObject[]) ?? []
  const bMeta = (bVal.fontMetaData as JsonObject[]) ?? []
  if (aMeta.length !== bMeta.length) {
    ctx.errors.push({
      path: ctx.path,
      key: `${ctx.key}.fontMetaData`,
      message: `length mismatch: ${aMeta.length} vs ${bMeta.length}`
    })
  } else {
    verifyFontMetadata(aMeta, bMeta, ctx)
  }

  return true
}

function guidToComponentValue(value: unknown): string | undefined {
  const guid = asRecord(value)
  const sessionID = guid?.sessionID
  const localID = guid?.localID
  if (typeof sessionID !== 'number' || typeof localID !== 'number') return undefined
  return `${sessionID}:${localID}`
}

function textValueCharacters(value: unknown): string | undefined {
  const textValue = asRecord(value)
  const characters = textValue?.characters
  return typeof characters === 'string' ? characters : undefined
}

function componentPropInitialValue(def: Record<string, unknown>): string | undefined {
  const initialValue = asRecord(def.initialValue)
  const textValue = textValueCharacters(initialValue?.textValue)
  if (textValue !== undefined) return textValue
  if (typeof initialValue?.boolValue === 'boolean') return String(initialValue.boolValue)

  const guidValue = guidToComponentValue(initialValue?.guidValue)
  if (guidValue !== undefined) return guidValue

  const varValue = asRecord(def.varValue)
  const value = asRecord(varValue?.value)
  const symbolValue = asRecord(value?.symbolIdValue)
  const symbolGuid = guidToComponentValue(symbolValue?.guid)
  if (symbolGuid !== undefined) return symbolGuid

  const varTextValue = value?.textValue
  if (typeof varTextValue === 'string') return varTextValue
  if (typeof value?.boolValue === 'boolean') return String(value.boolValue)
  return undefined
}

function isComponentPropTypeEquivalent(aType: unknown, bType: unknown): boolean {
  return aType === bType || (aType === 'VARIANT' && bType === 'TEXT')
}

function verifySingleComponentPropDef(
  aDef: Record<string, unknown>,
  bDef: Record<string, unknown>
): boolean {
  if (JSON.stringify(aDef.id) !== JSON.stringify(bDef.id)) return false
  if (aDef.name !== bDef.name) return false
  if (!isComponentPropTypeEquivalent(aDef.type, bDef.type)) return false

  const aInitialValue = componentPropInitialValue(aDef)
  const bInitialValue = componentPropInitialValue(bDef)
  return aInitialValue === bInitialValue
}

export function verifyComponentPropDefs(a: unknown, b: unknown): boolean {
  const aDefs = a as JsonObject[] | undefined
  const bDefs = b as JsonObject[] | undefined
  if (!aDefs && !bDefs) return true
  if (!aDefs || !bDefs) return false
  if (aDefs.length !== bDefs.length) return false
  return aDefs.every((aDef, index) => verifySingleComponentPropDef(aDef, bDefs[index]))
}
