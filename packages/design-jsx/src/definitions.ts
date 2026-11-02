export type DesignJSXNamedDefinition = {
  name: string
  description: string
}

export type DesignJSXPropertyDefinition = DesignJSXNamedDefinition
export type DesignJSXHelperDefinition = DesignJSXNamedDefinition

/** Props only `<Paragraph>` takes; like every element, it also takes `key`. */
export const DESIGN_JSX_PARAGRAPH_PROPERTY_NAMES = [
  'list',
  'level',
  'spacing',
  'listSpacing',
  'indent'
] as const

/** Props `<Span>` takes: `<Text>`'s character styles, under the same names, and a link. */
export const DESIGN_JSX_SPAN_PROPERTY_NAMES = [
  'style',
  'size',
  'fontSize',
  'font',
  'fontFamily',
  'weight',
  'fontWeight',
  'italic',
  'color',
  'fill',
  'fills',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationColor',
  'textDecorationThickness',
  'textUnderlineOffset',
  'textDecorationSkipInk',
  'fontFeatures',
  'fontVariations',
  'lang',
  'textCase',
  'href'
] as const

/** Props `<Text>` sets every paragraph's spacing with; a `<Paragraph>` sets its own. */
export const DESIGN_JSX_TEXT_PARAGRAPH_PROPERTY_NAMES = [
  'paragraphSpacing',
  'listSpacing',
  'paragraphIndent',
  'hangingList'
] as const

export const DESIGN_JSX_SUPPORTED_PROPERTY_NAMES = [
  'name',
  'key',
  'ref',
  'flex',
  'flow',
  'dir',
  'gap',
  'wrap',
  'rowGap',
  'columnGap',
  'justify',
  'justifyContent',
  'items',
  'align',
  'alignItems',
  'grow',
  'w',
  'h',
  'width',
  'height',
  'minW',
  'maxW',
  'minH',
  'maxH',
  'x',
  'y',
  'top',
  'left',
  'position',
  'constraints',
  'p',
  'padding',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'bg',
  'fill',
  'fills',
  'background',
  'backgroundColor',
  'stroke',
  'border',
  'borderColor',
  'strokeWidth',
  'borderWidth',
  'strokeAlign',
  'strokeDash',
  'strokeCap',
  'strokeJoin',
  'dashPattern',
  'strokes',
  'strokeWeights',
  'rounded',
  'borderRadius',
  'roundedTL',
  'roundedTR',
  'roundedBL',
  'roundedBR',
  'cornerRadius',
  'cornerSmoothing',
  'opacity',
  'blendMode',
  'rotate',
  'rotation',
  'flipX',
  'flipY',
  'overflow',
  'mask',
  'visible',
  'locked',
  'shadow',
  'blur',
  'effects',
  'size',
  'fontSize',
  'font',
  'fontFamily',
  'weight',
  'fontWeight',
  'italic',
  'color',
  'text',
  'characters',
  'content',
  'value',
  'title',
  'markdown',
  'textAlign',
  'textAlignHorizontal',
  'textHorizontalAlignment',
  'textAlignVertical',
  'textVerticalAlignment',
  'textAutoResize',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationColor',
  'textDecorationThickness',
  'textUnderlineOffset',
  'textDecorationSkipInk',
  'fontFeatures',
  'fontVariations',
  'lang',
  'fontOpticalSizing',
  'textCase',
  'paragraphSpacing',
  'paragraphIndent',
  'hangingList',
  'list',
  'level',
  'spacing',
  'listSpacing',
  'indent',
  'maxLines',
  'truncate',
  'grid',
  'columns',
  'rows',
  'colStart',
  'rowStart',
  'col',
  'row',
  'colSpan',
  'rowSpan',
  'points',
  'pointCount',
  'innerRadius',
  'startAngle',
  'endAngle',
  'd',
  'fillRule',
  'paths',
  'label',
  'style',
  'bind',
  'component',
  'componentId',
  'properties',
  'of',
  'exposed',
  'overrides',
  'mode',
  // A Reka UI root's behaviour, by its own property names
  'modelValue',
  'open',
  'disabled',
  'filled',
  'states',
  'min',
  'max',
  'step',
  'defaultValue'
] as const

export const DESIGN_JSX_SUPPORTED_PROPERTIES = new Set<string>(DESIGN_JSX_SUPPORTED_PROPERTY_NAMES)

/**
 * Properties accepted under more than one name, keyed by the name Design JSX writes. The
 * renderer reads the first one set, in this order; editors use it to find a value written
 * under any of its names.
 */
export const DESIGN_JSX_PROPERTY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  w: ['width'],
  h: ['height'],
  bg: ['fill', 'background', 'backgroundColor'],
  stroke: ['border', 'borderColor'],
  rounded: ['cornerRadius', 'borderRadius'],
  rotate: ['rotation'],
  p: ['padding'],
  colStart: ['col'],
  rowStart: ['row'],
  justify: ['justifyContent'],
  items: ['align', 'alignItems'],
  size: ['fontSize'],
  font: ['fontFamily'],
  weight: ['fontWeight'],
  textAlign: ['textAlignHorizontal', 'textHorizontalAlignment'],
  textAlignVertical: ['textVerticalAlignment']
}

/** A CSS-style key read from the `style` prop; `px` values like `'320px'` become numbers. */
export interface DesignJSXStyleKey {
  key: string
  px?: boolean
}

/**
 * Properties also read from `style={{ … }}`, keyed by the name Design JSX writes, in the order
 * the renderer reads them. An attribute under any of the property's names wins over `style`.
 */
export const DESIGN_JSX_STYLE_KEYS: Readonly<Record<string, readonly DesignJSXStyleKey[]>> = {
  bg: [{ key: 'background' }, { key: 'backgroundColor' }],
  color: [{ key: 'color' }],
  stroke: [{ key: 'borderColor' }],
  strokeWidth: [{ key: 'borderWidth', px: true }],
  rounded: [{ key: 'borderRadius', px: true }],
  size: [{ key: 'fontSize', px: true }],
  weight: [{ key: 'fontWeight' }],
  w: [{ key: 'width', px: true }],
  h: [{ key: 'height', px: true }],
  opacity: [{ key: 'opacity' }]
}

/** Every name a property is accepted under, the written name first. */
export function designJSXPropertyNames(name: string): readonly string[] {
  return [name, ...(DESIGN_JSX_PROPERTY_ALIASES[name] ?? [])]
}

/** The value of a property under the first of its names that is set. */
export function designJSXProp(props: Readonly<Record<string, unknown>>, name: string): unknown {
  for (const key of designJSXPropertyNames(name)) {
    if (props[key] !== undefined && props[key] !== null) return props[key]
  }
  return undefined
}

export const DESIGN_JSX_PROPERTIES: DesignJSXPropertyDefinition[] =
  DESIGN_JSX_SUPPORTED_PROPERTY_NAMES.map((name) => ({
    name,
    description: `OpenPencil ${name} property.`
  }))
