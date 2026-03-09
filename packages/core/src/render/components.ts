import { node, type BaseProps, type TextProps, type TreeNode } from './tree'

export function Frame(props: BaseProps): TreeNode {
  return node('frame', props)
}

export function Text(props: TextProps): TreeNode {
  return node('text', props)
}

export function Rectangle(props: BaseProps): TreeNode {
  return node('rectangle', props)
}

export function Ellipse(props: BaseProps): TreeNode {
  return node('ellipse', props)
}

export function Line(props: BaseProps): TreeNode {
  return node('line', props)
}

export function Star(props: BaseProps & { points?: number; innerRadius?: number }): TreeNode {
  return node('star', props)
}

export function Polygon(props: BaseProps & { pointCount?: number }): TreeNode {
  return node('polygon', props)
}

export function Vector(props: BaseProps): TreeNode {
  return node('vector', props)
}

export function Group(props: BaseProps): TreeNode {
  return node('group', props)
}

export function Section(props: BaseProps): TreeNode {
  return node('section', props)
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
