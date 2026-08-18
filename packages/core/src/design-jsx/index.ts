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
  type TextProps,
  type StyleProps,
  type PaintProp,
  isTreeNode,
  node,
  resolveToTree
} from './tree'

export { renderTree, type RenderResult } from './renderer'

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

export { renderJSX, renderTreeNode, buildComponent } from './render'
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

import jsxReference from '#core/tools/prompts/jsx-reference.md?raw'

export { sceneNodeToJSX, selectionToJSX, type JSXFormat } from '#core/io/formats/jsx'
export const JSX_REFERENCE: string = jsxReference
