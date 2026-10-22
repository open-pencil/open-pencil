import type { Effect, Fill, SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { DesignVariable } from './vars'

export interface TreeNode {
  type: string
  props: Record<string, unknown>
  children: (TreeNode | string)[]
  /** Where the element was written, when the source is known. */
  source?: { line: number }
}

/** A fragment (`<>…</>`) groups siblings without creating a node of its own. */
export const FRAGMENT = ''

function inlineFragments(children: (TreeNode | string)[]): (TreeNode | string)[] {
  return children.flatMap((child) =>
    typeof child !== 'string' && child.type === FRAGMENT ? child.children : [child]
  )
}

/**
 * The text an element holds as children, such as a sticky note's body or a connector's label.
 * Elements among its children are not text and are skipped.
 */
export function plainTextOf(tree: TreeNode): string {
  return tree.children.filter((child): child is string => typeof child === 'string').join('')
}

export function isTreeNode(x: unknown): x is TreeNode {
  if (x === null || typeof x !== 'object') return false
  return (
    'type' in x &&
    typeof x.type === 'string' &&
    'props' in x &&
    'children' in x &&
    Array.isArray(x.children)
  )
}

type FunctionComponent = (props: Record<string, unknown>) => unknown

interface ReactElement {
  type: unknown
  props: Record<string, unknown>
}

function isReactElement(x: unknown): x is ReactElement {
  return x !== null && typeof x === 'object' && 'type' in x && 'props' in x
}

/**
 * Resolve any element-like value (ReactElement, TreeNode, function component)
 * into a TreeNode. Handles recursive function components up to depth 100.
 */
export function resolveToTree(element: unknown, depth = 0): TreeNode | null {
  if (depth > 100) throw new Error('Component resolution depth exceeded')
  if (element == null) return null
  if (isTreeNode(element)) return element
  if (!isReactElement(element)) return null

  if (typeof element.type === 'function') {
    const component = element.type as FunctionComponent
    return resolveToTree(component(element.props), depth + 1)
  }

  if (typeof element.type === 'string') {
    const children: (TreeNode | string)[] = []
    const elChildren = element.props.children
    if (elChildren != null) {
      const childArray = Array.isArray(elChildren) ? elChildren : [elChildren]
      for (const child of childArray.flat()) {
        if (child == null) continue
        if (typeof child === 'string' || typeof child === 'number') {
          children.push(String(child))
        } else {
          const resolved = resolveToTree(child, depth + 1)
          if (resolved) children.push(resolved)
        }
      }
    }
    const { children: _, ...props } = element.props
    return { type: element.type, props, children: inlineFragments(children) }
  }

  return null
}

function resolveChild(child: unknown): TreeNode | string | null {
  if (child == null) return null
  if (typeof child === 'string' || typeof child === 'number') return String(child)
  return resolveToTree(child)
}

export function node(
  type: string,
  props: { children?: unknown; [key: string]: unknown }
): TreeNode {
  const { children, ...rest } = props
  const processed = [children]
    .flat(Infinity)
    .map(resolveChild)
    .filter((c): c is TreeNode | string => c !== null)
  return { type, props: rest, children: inlineFragments(processed) }
}

export type PaintProp = string | Color | Fill | DesignVariable

export type StyleProps = {
  flex?: 'row' | 'col' | 'column'
  flow?: 'auto' | 'ltr' | 'rtl'
  dir?: 'auto' | 'ltr' | 'rtl'
  gap?: number | DesignVariable
  wrap?: boolean
  rowGap?: number | DesignVariable
  columnGap?: number | DesignVariable
  justify?: 'start' | 'end' | 'center' | 'between'
  justifyContent?: 'start' | 'end' | 'center' | 'between'
  items?: 'start' | 'end' | 'center' | 'stretch' | 'baseline'
  align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline'
  alignItems?: 'start' | 'end' | 'center' | 'stretch' | 'baseline'
  grow?: number

  w?: number | 'fill' | 'hug' | DesignVariable
  h?: number | 'fill' | 'hug' | DesignVariable
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number

  x?: number
  y?: number

  p?: number | DesignVariable
  px?: number | DesignVariable
  py?: number | DesignVariable
  pt?: number | DesignVariable
  pr?: number | DesignVariable
  pb?: number | DesignVariable
  pl?: number | DesignVariable

  bg?: PaintProp
  fill?: PaintProp
  fills?: PaintProp[]
  stroke?: PaintProp
  strokeWidth?: number | DesignVariable
  strokeAlign?: 'inside' | 'outside' | 'center'
  strokeDash?: number[] | boolean
  dashPattern?: number[]
  rounded?: number | DesignVariable
  roundedTL?: number | DesignVariable
  roundedTR?: number | DesignVariable
  roundedBL?: number | DesignVariable
  roundedBR?: number | DesignVariable
  cornerSmoothing?: number
  opacity?: number | DesignVariable
  blendMode?: string
  mask?: boolean | 'alpha' | 'luminance' | 'vector'
  rotate?: number
  rotation?: number
  /** Reflects the layer across its vertical centre line, before it turns. */
  flipX?: boolean
  /** Reflects the layer across its horizontal centre line, before it turns. */
  flipY?: boolean
  overflow?: 'hidden' | 'visible'
  shadow?: string
  blur?: number
  effects?: Effect[]

  size?: number | DesignVariable
  fontSize?: number | DesignVariable
  lineHeight?: number | 'auto' | DesignVariable
  letterSpacing?: number | DesignVariable
  /** OpenType features on or off by tag, as CSS's `font-feature-settings`: `{ tnum: true }`. */
  fontFeatures?: Record<string, boolean>
  /** Variable-font axis values by tag, as CSS's `font-variation-settings`: `{ wght: 650 }`. */
  fontVariations?: Record<string, number>
  /** The language the text is in, as a BCP 47 tag such as `de` or `sr-Latn`. */
  lang?: string | null
  font?: string
  fontFamily?: string
  weight?: number | 'bold' | 'medium' | 'normal'
  fontWeight?: number | 'bold' | 'medium' | 'normal'
  color?: PaintProp
  text?: string
  characters?: string
  textAlign?: 'left' | 'center' | 'right' | 'justified'
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textHorizontalAlignment?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM'
  textVerticalAlignment?: 'TOP' | 'CENTER' | 'BOTTOM'
  textAutoResize?: 'none' | 'width' | 'height'
}

type NodeProps = StyleProps & {
  name?: string
  key?: string | number
  children?: unknown
  bind?: Record<string, unknown>
  propertyRefs?: SceneNode['componentPropertyReferences']
  [key: string]: unknown
}

export type BaseProps = NodeProps & { properties?: never }

/** An `<Ellipse>`'s arc: angles in degrees, clockwise from three o'clock, and its hole. */
export type EllipseProps = {
  startAngle?: number
  endAngle?: number
  /** The hole as a share of the ellipse, from 0 (none) to 1. */
  innerRadius?: number
}
export type TextProps = BaseProps

/** A `<Span>`'s props: the character styles of `<Text>`, under the same names. */
export type SpanProps = Pick<
  StyleProps,
  | 'size'
  | 'fontSize'
  | 'font'
  | 'fontFamily'
  | 'weight'
  | 'fontWeight'
  | 'color'
  | 'fill'
  | 'fills'
  | 'lineHeight'
  | 'letterSpacing'
  | 'fontFeatures'
  | 'fontVariations'
  | 'lang'
> & {
  key?: string | number
  style?: Record<string, unknown>
  italic?: boolean
  textDecoration?: 'none' | 'underline' | 'strikethrough'
  textDecorationStyle?: 'solid' | 'dotted' | 'wavy'
  textDecorationColor?: string | Color | Fill
  textDecorationThickness?: number | 'auto'
  textUnderlineOffset?: number | 'auto'
  textDecorationSkipInk?: boolean
  children?: unknown
}

/** A `<Paragraph>`'s props: a list item at `level` 1–5, or a plain paragraph, and its spacing. */
export type ParagraphProps = {
  key?: string | number
  list?: 'ordered' | 'unordered'
  level?: number
  spacing?: number
  listSpacing?: number
  indent?: number
  children?: unknown
}

export type ComponentProps = NodeProps & {
  properties?: SceneNode['componentPropertyDefinitions']
}

export type InstanceProps = NodeProps & {
  component?: string
  componentId?: string
  of?: string
  properties?: SceneNode['componentPropertyAssignments']
}
