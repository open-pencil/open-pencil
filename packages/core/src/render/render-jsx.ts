import * as React from './mini-react'
import { renderTree, type RenderResult } from './renderer'
import { resolveToTree, type TreeNode } from './tree'

import type { SceneGraph } from '../scene-graph'

/**
 * Build a component function from a JSX string using esbuild.
 * Uses mini-react createElement — no React dependency.
 * Only works in Node/Bun — not available in the browser.
 */
export async function buildComponent(jsxString: string): Promise<() => unknown> {
  let esbuild: typeof import('esbuild')
  try {
    esbuild = await import('esbuild')
  } catch {
    throw new Error(
      'esbuild is required for JSX string rendering. Install it or use renderTreeNode() instead.'
    )
  }

  const code = `
    const h = React.createElement
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    return function Component() { return ${jsxString.trim()} }
  `

  const result = esbuild.transformSync(code, {
    loader: 'tsx',
    jsx: 'transform',
    jsxFactory: 'h'
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
 * For headless/CLI use — requires esbuild.
 */
export async function renderJSX(
  graph: SceneGraph,
  jsxString: string,
  options?: RenderJSXOptions
): Promise<RenderResult> {
  const Component = await buildComponent(jsxString)
  const element = React.createElement(Component, null)
  const tree = resolveToTree(element)

  if (!tree) {
    throw new Error('JSX must return a Figma element (Frame, Text, etc)')
  }

  return renderTree(graph, tree, options)
}

/**
 * Render a pre-built TreeNode into the scene graph.
 * For in-browser use — no esbuild needed, tree is built by the AI SDK tool call.
 */
export function renderTreeNode(
  graph: SceneGraph,
  tree: TreeNode,
  options?: RenderJSXOptions
): RenderResult {
  return renderTree(graph, tree, options)
}
