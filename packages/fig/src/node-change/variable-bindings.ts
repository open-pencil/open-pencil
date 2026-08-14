import type { VariableConsumptionEntry } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneNode } from '@open-pencil/scene-graph'

export const VARIABLE_BINDING_FIELDS: Record<string, string> = {
  cornerRadius: 'CORNER_RADIUS',
  topLeftRadius: 'RECTANGLE_TOP_LEFT_CORNER_RADIUS',
  topRightRadius: 'RECTANGLE_TOP_RIGHT_CORNER_RADIUS',
  bottomLeftRadius: 'RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS',
  bottomRightRadius: 'RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS',
  strokeWeight: 'STROKE_WEIGHT',
  borderTopWeight: 'BORDER_TOP_WEIGHT',
  borderBottomWeight: 'BORDER_BOTTOM_WEIGHT',
  borderLeftWeight: 'BORDER_LEFT_WEIGHT',
  borderRightWeight: 'BORDER_RIGHT_WEIGHT',
  itemSpacing: 'STACK_SPACING',
  paddingLeft: 'STACK_PADDING_LEFT',
  paddingTop: 'STACK_PADDING_TOP',
  paddingRight: 'STACK_PADDING_RIGHT',
  paddingBottom: 'STACK_PADDING_BOTTOM',
  counterAxisSpacing: 'STACK_COUNTER_SPACING',
  gridRowGap: 'GRID_ROW_GAP',
  gridColumnGap: 'GRID_COLUMN_GAP',
  visible: 'VISIBLE',
  opacity: 'OPACITY',
  width: 'WIDTH',
  height: 'HEIGHT',
  minWidth: 'MIN_WIDTH',
  maxWidth: 'MAX_WIDTH',
  minHeight: 'MIN_HEIGHT',
  maxHeight: 'MAX_HEIGHT',
  x: 'X_POSITION',
  y: 'Y_POSITION',
  rotation: 'ROTATION',
  fontSize: 'FONT_SIZE',
  letterSpacing: 'LETTER_SPACING',
  lineHeight: 'LINE_HEIGHT',
  fontFamily: 'FONT_FAMILY'
}

export const VARIABLE_BINDING_FIELDS_INVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(VARIABLE_BINDING_FIELDS).map(([field, kiwiField]) => [kiwiField, field])
)

export interface ResolvedVariableConsumption {
  field: string
  variableId: string
}

export function resolveVariableConsumptionEntry(
  entry: VariableConsumptionEntry
): ResolvedVariableConsumption | undefined {
  const field = entry.variableField
    ? VARIABLE_BINDING_FIELDS_INVERSE[entry.variableField]
    : undefined
  const guid = entry.variableData?.value?.alias?.guid
  return field && guid ? { field, variableId: guidToString(guid) } : undefined
}

const NUMERIC_BINDING_FIELDS = new Set([
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius',
  'strokeWeight',
  'borderTopWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'borderRightWeight',
  'itemSpacing',
  'paddingLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'counterAxisSpacing',
  'gridRowGap',
  'gridColumnGap',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'x',
  'y',
  'rotation',
  'fontSize',
  'letterSpacing',
  'lineHeight'
])

export function resolvedNumericBindingUpdate(
  field: string,
  value: number
): Partial<SceneNode> | undefined {
  if (field === 'opacity') return { opacity: Math.max(0, Math.min(1, value / 100)) }
  return NUMERIC_BINDING_FIELDS.has(field) ? { [field]: value } : undefined
}
