import { isEqual } from 'es-toolkit/predicate'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const SHAPING_FIELDS = [
  'fontSize',
  'fontName',
  'fontVariations',
  'letterSpacing',
  'lineHeight',
  'textCase',
  'textAlignHorizontal',
  'textAlignVertical',
  'textAutoResize',
  'styleIdForText',
  'fontVariantCommonLigatures',
  'fontVariantContextualLigatures'
] as const

/** Drop source glyph caches only when a patch changes shaping and supplies no replacement. */
export function invalidateInheritedTextData(
  source: NodeChange,
  patch: Record<string, unknown>
): void {
  if ('derivedTextData' in patch) return
  const text = patch.textData as NodeChange['textData']
  const changedText =
    text !== undefined &&
    Object.entries(text).some(
      ([field, value]) =>
        !isEqual(value, source.textData?.[field as keyof NonNullable<NodeChange['textData']>])
    )
  if (
    changedText ||
    SHAPING_FIELDS.some((field) => field in patch && !isEqual(source[field], patch[field]))
  ) {
    source.derivedTextData = undefined
  }
}
