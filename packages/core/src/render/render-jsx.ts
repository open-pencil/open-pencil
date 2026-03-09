import { transform } from 'sucrase'

import * as React from './mini-react'
import { renderTree, type RenderResult } from './renderer'
import { resolveToTree, type TreeNode } from './tree'

import type { SceneGraph } from '../scene-graph'

/**
 * Strip TypeScript-only syntax that sucrase's JSX-only transform can't handle.
 * AI models sometimes emit `as any`, `as const`, etc.
 */
function stripTypeAnnotations(jsx: string): string {
  return jsx.replace(/\bas\s+(any|const|string|number|unknown)\b/g, '')
}

/**
 * Build a component function from a JSX string using sucrase.
 * Works in both Node/Bun and the browser (no native bindings).
 */
export function buildComponent(jsxString: string): () => unknown {
  const sanitized = stripTypeAnnotations(jsxString.trim())

  const code = `
    const h = React.createElement
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    return function Component() { return ${sanitized} }
  `

  const result = transform(code, {
    transforms: ['jsx'],
    jsxPragma: 'h',
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
export function renderJSX(
  graph: SceneGraph,
  jsxString: string,
  options?: RenderJSXOptions
): RenderResult {
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
export function renderTreeNode(
  graph: SceneGraph,
  tree: TreeNode,
  options?: RenderJSXOptions
): RenderResult {
  return renderTree(graph, tree, options)
}
