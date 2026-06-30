import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

const TEXT_STYLE_FIELDS = [
  'fontSize',
  'fontName',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase'
] as const

type StyleRefFields = Record<string, unknown> & {
  styleIdForFill?: { guid?: GUID }
  styleIdForStrokeFill?: { guid?: GUID }
  styleIdForText?: { guid?: GUID }
}

type StyleSource = Pick<
  NodeChange,
  | 'type'
  | 'styleType'
  | 'fillPaints'
  | 'fontSize'
  | 'fontName'
  | 'lineHeight'
  | 'letterSpacing'
  | 'textDecoration'
  | 'textCase'
>

export function applyStyleRefsToFields(
  changeMap: ReadonlyMap<string, Partial<StyleSource>>,
  fields: StyleRefFields
): void {
  const fillStyleGuid = fields.styleIdForFill?.guid
  if (fillStyleGuid) {
    const style = changeMap.get(guidToString(fillStyleGuid))
    if (style?.styleType === 'FILL' && style.fillPaints) fields.fillPaints = style.fillPaints
  }

  const strokeFillStyleGuid = fields.styleIdForStrokeFill?.guid
  if (strokeFillStyleGuid) {
    const style = changeMap.get(guidToString(strokeFillStyleGuid))
    if (style?.styleType === 'FILL' && style.fillPaints) fields.strokePaints = style.fillPaints
  }

  const textStyleGuid = fields.styleIdForText?.guid
  if (!textStyleGuid) return

  const style = changeMap.get(guidToString(textStyleGuid))
  if (style?.type !== 'TEXT' || style.styleType !== 'TEXT') return

  for (const field of TEXT_STYLE_FIELDS) {
    if (field === 'textDecoration') {
      fields.textDecoration = style.textDecoration
    } else if (style[field] !== undefined) {
      fields[field] = style[field]
    }
  }
}
