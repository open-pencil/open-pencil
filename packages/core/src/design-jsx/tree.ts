import type { Effect, Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { DesignVariable } from './vars'

export interface TreeNode {
  type: string
  props: Record<string, unknown>
  children: (TreeNode | string)[]
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
    return { type: element.type, props, children }
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
  return { type, props: rest, children: processed }
}

export type PaintProp = string | Color | Fill | DesignVariable

export type StyleProps = {
  flex?: 'row' | 'col' | 'column'
  flow?: 'auto' | 'ltr' | 'rtl'
  dir?: 'auto' | 'ltr' | 'rtl'
  gap?: number
  wrap?: boolean
  rowGap?: number
  justify?: 'start' | 'end' | 'center' | 'between'
  justifyContent?: 'start' | 'end' | 'center' | 'between'
  items?: 'start' | 'end' | 'center' | 'stretch'
  align?: 'start' | 'end' | 'center' | 'stretch'
  alignItems?: 'start' | 'end' | 'center' | 'stretch'
  grow?: number

  w?: number | 'fill' | 'hug'
  h?: number | 'fill' | 'hug'
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number

  x?: number
  y?: number

  p?: number
  px?: number
  py?: number
  pt?: number
  pr?: number
  pb?: number
  pl?: number

  bg?: PaintProp
  fill?: PaintProp
  fills?: PaintProp[]
  stroke?: PaintProp
  strokeWidth?: number
  strokeAlign?: 'inside' | 'outside' | 'center'
  strokeDash?: number[] | boolean
  rounded?: number
  roundedTL?: number
  roundedTR?: number
  roundedBL?: number
  roundedBR?: number
  cornerSmoothing?: number
  opacity?: number
  blendMode?: string
  rotate?: number
  rotation?: number
  overflow?: 'hidden' | 'visible'
  shadow?: string
  blur?: number
  effects?: Effect[]

  size?: number
  fontSize?: number
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

export type BaseProps = StyleProps & {
  name?: string
  key?: string | number
  children?: unknown
  bind?: Record<string, unknown>
  [key: string]: unknown
}

export type TextProps = BaseProps
