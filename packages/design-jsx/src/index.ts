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
  Accordion,
  Button,
  Checkbox,
  Collapsible,
  NumberField,
  Progress,
  RadioGroup,
  Slider,
  Switch,
  Tabs,
  Textarea,
  TextField,
  Toggle,
  ToggleGroup,
  type RekaElement,
  type RekaProps
} from './behaviours/elements'

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
  DESIGN_JSX_PROPERTY_ALIASES,
  DESIGN_JSX_STYLE_KEYS,
  type DesignJSXStyleKey,
  designJSXProp,
  designJSXPropertyNames,
  type DesignJSXElementDefinition,
  type DesignJSXHelperDefinition,
  type DesignJSXPropertyDefinition
} from './schema'
export {
  transformDesignJSXExpression,
  transformDesignJSXProgram,
  type DesignJSXChunk,
  type DesignJSXProgram
} from './transform'

export {
  designJSXElement,
  sceneNodeAttributes,
  sceneNodeToJSX,
  selectionToJSX,
  selectionToJSXWithLayers,
  type DesignJSXElement,
  type DesignJSXWithLayers,
  type JSXAttributeSource
} from './export'
export { parseJSXAttributes } from './attributes'
export { jsxNodeFields, type JSXNodeFields } from './fields'
export { reconcileRenderedLayers } from './reconcile'
export { JSX_REFERENCE, AUTHORING_EXAMPLES, type AuthoringExample } from './reference'
export {
  createStreamingJSXParser,
  type JSXPreviewNode,
  type JSXPreviewPending,
  type JSXPreviewSnapshot
} from './streaming'
