import type { NodeChange, StyleReference } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

export const TEXT_STYLE_FIELDS = [
  'fontSize',
  'fontName',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase'
] as const

export type TextStyleField = (typeof TEXT_STYLE_FIELDS)[number]

export type StyleSource = Pick<
  NodeChange,
  'type' | 'styleType' | 'fillPaints' | 'effects' | 'layoutGrids' | TextStyleField
>

export type StyleChangeMap = ReadonlyMap<string, Partial<StyleSource>>

export function referencedStyle(
  changeMap: StyleChangeMap,
  reference: StyleReference | undefined,
  assetRefs?: ReadonlyMap<string, string>
): Partial<StyleSource> | undefined {
  if (reference?.guid) {
    return changeMap.get(guidToString(reference.guid))
  }
  if (!reference?.assetRef || !assetRefs) {
    return undefined
  }
  const { key, version } = reference.assetRef
  const id = (version ? assetRefs.get(`${key}@${version}`) : undefined) ?? assetRefs.get(key)
  return id ? changeMap.get(id) : undefined
}

export function assetIdsByKey(records: Iterable<NodeChange>): Map<string, string> {
  const assets = new Map<string, string>()
  for (const node of records) {
    if (node.guid && typeof node.key === 'string') {
      const id = guidToString(node.guid)
      assets.set(node.key, id)
      if (typeof node.version === 'string') {
        assets.set(`${node.key}@${node.version}`, id)
      }
    }
  }
  return assets
}

export type TextStyleLookup = (
  reference: StyleReference | undefined
) => Partial<StyleSource> | undefined

export function createTextStyleLookup(
  changeMap: StyleChangeMap,
  assetRefs: ReadonlyMap<string, string>
): TextStyleLookup {
  return (reference) => {
    const style = referencedStyle(changeMap, reference, assetRefs)
    return style?.type === 'TEXT' && style.styleType === 'TEXT' ? style : undefined
  }
}

/** The fields a text style gives a layer; a style without a decoration clears the layer's. */
export function textStyleValues(
  style: Partial<StyleSource>
): Partial<Pick<NodeChange, TextStyleField>> {
  const values: Partial<Pick<NodeChange, TextStyleField>> = { textDecoration: style.textDecoration }
  for (const field of TEXT_STYLE_FIELDS) {
    if (style[field] !== undefined) {
      Object.assign(values, { [field]: style[field] })
    }
  }
  return values
}
