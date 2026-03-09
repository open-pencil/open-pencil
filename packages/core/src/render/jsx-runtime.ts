import { node, type BaseProps, type TreeNode, type TextProps } from './tree'

export function jsx(type: string | ((props: BaseProps) => TreeNode), props: BaseProps): TreeNode {
  if (typeof type === 'function') {
    return type(props)
  }
  return node(type, props)
}

export const jsxs = jsx
export const jsxDEV = jsx

export function Fragment({ children }: { children?: unknown }): TreeNode {
  return node('fragment', { children })
}

export namespace JSX {
  export type Element = TreeNode

  export interface IntrinsicElements {
    frame: BaseProps
    text: TextProps
    rectangle: BaseProps
    ellipse: BaseProps
    line: BaseProps
    star: BaseProps & { points?: number; innerRadius?: number }
    polygon: BaseProps & { pointCount?: number }
    vector: BaseProps
    group: BaseProps
    section: BaseProps
  }

  export interface ElementChildrenAttribute {
    children: {}
  }
}
