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

export { sceneNodeToJSX, selectionToJSX, type JSXFormat } from '#core/io/formats/jsx'
export { default as JSX_REFERENCE } from '#core/tools/prompts/jsx-reference.md'
