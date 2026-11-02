import { isPlainObject } from 'es-toolkit'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { UNSET_GUID } from '@open-pencil/kiwi/fig/guid'

import type { STYLE_REFERENCE_FIELDS } from '../document/style-dependencies'
import { OVERRIDE_FIELDS } from './fields'
import type { InstanceOccurrence } from './occurrence/types'

/** The raw fields each style reference gives the layer, with those the record keeps beside them. */
export const STYLE_GOVERNED_FIELDS = {
  styleIdForFill: ['fillPaints', 'backgroundPaints', 'backgroundColor'],
  styleIdForStrokeFill: ['strokePaints'],
  styleIdForText: [
    'fontName',
    'fontVersion',
    'fontSize',
    'semanticWeight',
    'semanticItalic',
    'lineHeight',
    'letterSpacing',
    'textTracking',
    'textDecoration',
    'textCase',
    'fontVariantCommonLigatures',
    'fontVariantContextualLigatures',
    'toggledOnOTFeatures',
    'toggledOffOTFeatures',
    'paragraphSpacing',
    'paragraphIndent',
    'listSpacing'
  ],
  styleIdForEffect: ['effects'],
  styleIdForGrid: ['layoutGrids']
} as const satisfies Record<(typeof STYLE_REFERENCE_FIELDS)[number], readonly string[]>

type StyleReferenceField = keyof typeof STYLE_GOVERNED_FIELDS

/** Whether a style reference is the unset GUID an instance claims to clear a style with. */
export function isClearedStyle(reference: unknown): boolean {
  if (!isPlainObject(reference) || !isPlainObject(reference.guid)) return false
  const { sessionID, localID } = reference.guid
  return sessionID === UNSET_GUID.sessionID && localID === UNSET_GUID.localID
}

/** The value the source record gives a field, or Figma's default when the record leaves it out. */
function sourceValue(source: NodeChange | undefined, field: string): unknown {
  const own = source?.[field]
  if (own !== undefined || !(field in OVERRIDE_FIELDS)) return own
  const spec = OVERRIDE_FIELDS[field as keyof typeof OVERRIDE_FIELDS]
  return 'absent' in spec ? spec.absent : undefined
}

/**
 * A style reference and the fields it governs are one override: an outer instance that clears a
 * style an intermediate component applied, and leaves a governed field out of its claim, shows the
 * value of the component the layer comes from for that field, not the intermediate one. The claim
 * is completed with those values, as Figma writes it, so later claims and export see them.
 */
export function completeClearedStyleClaim(
  target: InstanceOccurrence,
  claim: Partial<NodeChange>,
  source: NodeChange | undefined
): void {
  for (const reference of Object.keys(STYLE_GOVERNED_FIELDS) as StyleReferenceField[]) {
    if (!isClearedStyle(claim[reference])) continue
    const governed: readonly string[] = STYLE_GOVERNED_FIELDS[reference]
    for (const field of governed) {
      if (field in claim) continue
      const value = sourceValue(source, field)
      if (value === undefined) Reflect.deleteProperty(target.properties, field)
      else claim[field] = structuredClone(value)
    }
  }
}
