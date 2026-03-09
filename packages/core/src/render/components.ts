import { node, type BaseProps, type TextProps, type TreeNode } from './tree'

type Child = TreeNode | string

function withChildren(type: string, props: Record<string, unknown>, children: Child[]): TreeNode {
  if (children.length > 0) {
    return node(type, { ...props, children })
  }
  return node(type, props)
}

export function Frame(props: BaseProps, ...children: Child[]): TreeNode {
  return withChildren('frame', props, children)
}

export function Text(props: TextProps, ...children: Child[]): TreeNode {
  return withChildren('text', props, children)
}

export function Rectangle(props: BaseProps, ...children: Child[]): TreeNode {
  return withChildren('rectangle', props, children)
}

export function Ellipse(props: BaseProps, ...children: Child[]): TreeNode {
  return withChildren('ellipse', props, children)
}

export function Line(props: BaseProps, ...children: Child[]): TreeNode {
  return withChildren('line', props, children)
}

export function Star(props: BaseProps & { points?: number; innerRadius?: number }, ...children: Child[]): TreeNode {
  return withChildren('star', props, children)
}

export function Polygon(props: BaseProps & { pointCount?: number }, ...children: Child[]): TreeNode {
  return withChildren('polygon', props, children)
}

export function Vector(props: BaseProps, ...children: Child[]): TreeNode {
  return withChildren('vector', props, children)
}

export function Group(props: BaseProps, ...children: Child[]): TreeNode {
  return withChildren('group', props, children)
}

export function Section(props: BaseProps, ...children: Child[]): TreeNode {
  return withChildren('section', props, children)
}

export const View = Frame
export const Rect = Rectangle
export const Component = Frame
export const Instance = Frame
export const Page = Frame

export const INTRINSIC_ELEMENTS = [
  'frame',
  'text',
  'rectangle',
  'ellipse',
  'line',
  'star',
  'polygon',
  'vector',
  'group',
  'section'
] as const
