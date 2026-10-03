export {
  Frame,
  Text,
  Rectangle,
  Ellipse,
  Line,
  Star,
  Polygon,
  Vector,
  Group,
  Section,
  Component,
  ComponentSet,
  Instance,
  View,
  Rect,
  Page,
  INTRINSIC_ELEMENTS
} from './components'

export {
  type TreeNode,
  type BaseProps,
  type ComponentProps,
  type InstanceProps,
  type TextProps,
  type StyleProps,
  type PaintProp,
  isTreeNode,
  node,
  resolveToTree
} from './tree'

export type { RenderResult } from './renderer'

export {
  backgroundBlur,
  dropShadow,
  foregroundBlur,
  innerShadow,
  layerBlur,
  type BlurEffectOptions,
  type EffectColor,
  type ShadowEffectOptions
} from './effects'

export {
  angularGradient,
  diamondGradient,
  gradient,
  linearGradient,
  radialGradient,
  solid,
  type GradientPaintOptions,
  type PaintColor,
  type PaintStop,
  type SolidPaintOptions
} from './paints'

export { defineVars, designVar, isVariable, type DesignVariable, type VarDef } from './vars'

export { createElement } from './mini-react'

export { buildComponent, createDesignJSXRenderer, type DesignJSXRenderer } from './render'
export type { ArtworkPlacement, DesignJSXServices, SVGSource } from './services'
export type { RenderOptions } from './types'
export {
  DESIGN_JSX_ELEMENTS,
  DESIGN_JSX_HELPERS,
  DESIGN_JSX_PROPERTIES,
  DESIGN_JSX_SUPPORTED_PROPERTIES,
  DESIGN_JSX_SUPPORTED_PROPERTY_NAMES,
  type DesignJSXElementDefinition,
  type DesignJSXHelperDefinition,
  type DesignJSXPropertyDefinition
} from './schema'
export { transformDesignJSXExpression } from './transform'

export {
  sceneNodeAttributes,
  sceneNodeToJSX,
  selectionToJSX,
  type JSXAttributeSource
} from './export'
export { parseJSXAttributes } from './attributes'
export { jsxNodeFields, type JSXNodeFields } from './fields'
export { JSX_REFERENCE, AUTHORING_EXAMPLES, type AuthoringExample } from './reference'
export {
  createStreamingJSXParser,
  type JSXPreviewNode,
  type JSXPreviewPending,
  type JSXPreviewSnapshot
} from './streaming'
