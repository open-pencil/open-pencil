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
  items?: 'start' | 'end' | 'center' | 'stretch'
  align?: 'start' | 'end' | 'center' | 'stretch'
  alignItems?: 'start' | 'end' | 'center' | 'stretch'
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
  overflow?: 'hidden' | 'visible'
  shadow?: string
  blur?: number
  effects?: Effect[]

  size?: number | DesignVariable
  fontSize?: number | DesignVariable
  lineHeight?: number | DesignVariable
  letterSpacing?: number | DesignVariable
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
export type TextProps = BaseProps

export type ComponentProps = NodeProps & {
  properties?: SceneNode['componentPropertyDefinitions']
}

export type InstanceProps = NodeProps & {
  component?: string
  componentId?: string
  of?: string
  properties?: SceneNode['componentPropertyAssignments']
}
