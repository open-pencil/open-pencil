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

export const DESIGN_JSX_PROPERTIES: DesignJSXPropertyDefinition[] = [
  'name',
  'w',
  'h',
  'x',
  'y',
  'fill',
  'stroke',
  'strokeWidth',
  'rounded',
  'opacity',
  'flex',
  'gap',
  'p',
  'px',
  'py',
  'items',
  'justify',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'color'
].map((name) => ({ name, description: `OpenPencil ${name} property.` }))

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
  'foregroundBlur'
].map((name) => ({ name, description: `OpenPencil ${name} helper.` }))
