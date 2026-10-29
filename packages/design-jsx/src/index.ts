export {
  Frame,
  Text,
  Span,
  Paragraph,
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
  type EllipseProps,
  type VectorProps,
  type ComponentProps,
  type InstanceProps,
  type TextProps,
  type SpanProps,
  type ParagraphProps,
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
  shader,
  solid,
  type GradientPaintOptions,
  type PaintColor,
  type PaintStop,
  type ShaderFill,
  type SolidPaintOptions
} from './paints'

export {
  defineMode,
  defineVars,
  designMode,
  designVar,
  isMode,
  isVariable,
  isVariableInput,
  type DesignMode,
  type DesignVariable,
  type VariableInput
} from './variables'
export { isComponentProperty, property, type ComponentProperty } from './component-properties'
export { isLayerRef, ref, type LayerRef } from './refs'

export { createElement } from './mini-react'

export { buildComponent, createDesignJSXRenderer, type DesignJSXRenderer } from './render'
export type { ArtworkPlacement, DesignJSXServices, SVGSource } from './services'
export type { RenderOptions } from './types'
export {
  DESIGN_JSX_ELEMENTS,
  elementPropsByName,
  type DesignJSXElementDefinition
} from './elements'
export { DESIGN_JSX_HELPERS, designJSXHelpers, type DesignJSXHelperName } from './helpers'
export {
  DESIGN_JSX_PROPERTIES,
  DESIGN_JSX_SUPPORTED_PROPERTIES,
  DESIGN_JSX_SUPPORTED_PROPERTY_NAMES,
  DESIGN_JSX_PROPERTY_ALIASES,
  DESIGN_JSX_PARAGRAPH_PROPERTY_NAMES,
  DESIGN_JSX_SPAN_PROPERTY_NAMES,
  DESIGN_JSX_STYLE_KEYS,
  DESIGN_JSX_TEXT_PARAGRAPH_PROPERTY_NAMES,
  type DesignJSXStyleKey,
  designJSXProp,
  designJSXPropertyNames,
  type DesignJSXHelperDefinition,
  type DesignJSXPropertyDefinition
} from './definitions'
export {
  transformDesignJSXExpression,
  transformDesignJSXProgram,
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
  type JSXAttributeSource,
  type JSXExportOptions
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
