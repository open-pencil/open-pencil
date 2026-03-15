import { transform } from 'sucrase'

import * as React from './mini-react'
import { renderTree, type RenderResult } from './renderer'
import { resolveToTree, type TreeNode } from './tree'

import type { SceneGraph } from '../scene-graph'

/**
 * Build a component function from a JSX string using sucrase.
 * Works in both Node/Bun and the browser (no native bindings).
 */
export function buildComponent(jsxString: string): () => unknown {
  const code = `
    const __h = React.createElement
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    const Icon = 'icon'
    return function Component() { return ${jsxString.trim()} }
  `

  const result = transform(code, {
    transforms: ['typescript', 'jsx'],
    jsxPragma: '__h',
    production: true
  })

  return new Function('React', result.code)(React) as () => unknown
}

interface RenderJSXOptions {
  x?: number
  y?: number
  parentId?: string
}

/**
 * Render a JSX string into the scene graph.
 * Works in both Node/Bun and the browser.
 */
export async function renderJSX(
  graph: SceneGraph,
  jsxString: string,
  options?: RenderJSXOptions
): Promise<RenderResult> {
  const Component = buildComponent(jsxString)
  const element = React.createElement(Component, null)
  const tree = resolveToTree(element)

  if (!tree) {
    throw new Error('JSX must return a Figma element (Frame, Text, etc)')
  }

  return renderTree(graph, tree, options)
}

/**
 * Render a pre-built TreeNode into the scene graph.
 */
export async function renderTreeNode(
  graph: SceneGraph,
  tree: TreeNode,
  options?: RenderJSXOptions
): Promise<RenderResult> {
  return renderTree(graph, tree, options)
}
