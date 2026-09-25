export const NUMERIC_FIELDS = new Set([
  'opacity',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'x',
  'y',
  'rotation',
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
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'itemSpacing',
  'counterAxisSpacing',
  'gridRowGap',
  'gridColumnGap'
])

export function isNumericVariableBindingField(field: string): boolean {
  return NUMERIC_FIELDS.has(field)
}
