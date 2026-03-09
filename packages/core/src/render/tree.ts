export interface TreeNode {
  type: string
  props: Record<string, unknown>
  children: (TreeNode | string)[]
}

export function isTreeNode(x: unknown): x is TreeNode {
  if (x === null || typeof x !== 'object') return false
  return 'type' in x && typeof x.type === 'string' && 'props' in x && 'children' in x && Array.isArray(x.children)
}

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
    return resolveToTree(
      (element.type as (p: Record<string, unknown>) => unknown)(element.props),
      depth + 1
    )
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

export function node(type: string, props: { children?: unknown; [key: string]: unknown }): TreeNode {
  const { children, ...rest } = props
  const processed = [children]
    .flat(Infinity)
    .map(resolveChild)
    .filter((c): c is TreeNode | string => c !== null)
  return { type, props: rest, children: processed }
}

export type StyleProps = {
  flex?: 'row' | 'col' | 'column'
  gap?: number
  wrap?: boolean
  rowGap?: number
  justify?: 'start' | 'end' | 'center' | 'between'
  items?: 'start' | 'end' | 'center' | 'stretch'
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

  bg?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeAlign?: 'inside' | 'outside' | 'center'
  rounded?: number
  roundedTL?: number
  roundedTR?: number
  roundedBL?: number
  roundedBR?: number
  cornerSmoothing?: number
  opacity?: number
  blendMode?: string
  rotate?: number
  overflow?: 'hidden' | 'visible'
  shadow?: string
  blur?: number

  size?: number
  fontSize?: number
  font?: string
  fontFamily?: string
  weight?: number | 'bold' | 'medium' | 'normal'
  fontWeight?: number | 'bold' | 'medium' | 'normal'
  color?: string
  textAlign?: 'left' | 'center' | 'right' | 'justified'
  textAutoResize?: 'none' | 'width' | 'height'
}

export type BaseProps = StyleProps & {
  name?: string
  key?: string | number
  children?: unknown
}

export type TextProps = BaseProps
