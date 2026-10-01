export type DesignJSXElementDefinition = {
  name: string
  runtimeType: string
  description: string
}

export type DesignJSXNamedDefinition = {
  name: string
  description: string
}

export type DesignJSXPropertyDefinition = DesignJSXNamedDefinition
export type DesignJSXHelperDefinition = DesignJSXNamedDefinition

export const DESIGN_JSX_ELEMENTS: DesignJSXElementDefinition[] = [
  { name: 'Frame', runtimeType: 'frame', description: 'A frame or auto-layout container.' },
  { name: 'Text', runtimeType: 'text', description: 'A text layer.' },
  { name: 'Rectangle', runtimeType: 'rectangle', description: 'A rectangle layer.' },
  { name: 'Ellipse', runtimeType: 'ellipse', description: 'An ellipse layer.' },
  { name: 'Line', runtimeType: 'line', description: 'A line layer.' },
  { name: 'Star', runtimeType: 'star', description: 'A star layer.' },
  { name: 'Polygon', runtimeType: 'polygon', description: 'A polygon layer.' },
  { name: 'Vector', runtimeType: 'vector', description: 'A vector layer.' },
  { name: 'Group', runtimeType: 'group', description: 'A group of layers.' },
  { name: 'Section', runtimeType: 'section', description: 'A canvas section.' },
  { name: 'Component', runtimeType: 'component', description: 'A reusable component.' },
  { name: 'ComponentSet', runtimeType: 'component-set', description: 'A component variant set.' },
  { name: 'Instance', runtimeType: 'instance', description: 'An instance of a component.' },
  { name: 'View', runtimeType: 'frame', description: 'An alias for Frame.' },
  { name: 'Rect', runtimeType: 'rectangle', description: 'An alias for Rectangle.' },
  { name: 'Icon', runtimeType: 'icon', description: 'An Iconify icon.' }
]

export const DESIGN_JSX_SUPPORTED_PROPERTY_NAMES = [
  'name',
  'key',
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
  'textAlign',
  'textAlignHorizontal',
  'textHorizontalAlignment',
  'textAlignVertical',
  'textVerticalAlignment',
  'textAutoResize',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase',
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
  'label',
  'style',
  'bind',
  'component',
  'componentId',
  'properties',
  'propertyRefs',
  'of'
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

export const DESIGN_JSX_HELPERS: DesignJSXHelperDefinition[] = [
  'solid',
  'gradient',
  'linearGradient',
  'radialGradient',
  'angularGradient',
  'diamondGradient',
  'dropShadow',
  'innerShadow',
  'layerBlur',
  'backgroundBlur',
  'foregroundBlur',
  'designVar',
  'defineVars'
].map((name) => ({ name, description: `OpenPencil ${name} helper.` }))
