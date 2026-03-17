import { transform } from 'sucrase'

import * as React from './mini-react'
import { renderTree, type RenderResult } from './renderer'
import { resolveToTree, type TreeNode } from './tree'

import type { SceneGraph } from '../scene-graph'

/**
 * Build a component function from a JSX string using sucrase.
 * Works in both Node/Bun and the browser (no native bindings).
 * Supports single-root and multi-root JSX (multiple top-level elements
 * are wrapped in a fragment `<>...</>`).
 */
export function buildComponent(jsxString: string): () => unknown {
  const trimmed = jsxString.trim()
  const needsFragment = /^<[A-Za-z]/.test(trimmed) && hasMultipleRoots(trimmed)
  const jsx = needsFragment ? `<>${trimmed}</>` : trimmed

  const code = `
    const __h = React.createElement
    const __frag = ''
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    const Component = 'component', Instance = 'frame'
    const Icon = 'icon'
    return function __render() { return ${jsx} }
  `

  const result = transform(code, {
    transforms: ['typescript', 'jsx'],
    jsxPragma: '__h',
    jsxFragmentPragma: '__frag',
    production: true
  })

  return new Function('React', result.code)(React) as () => unknown
}

function hasMultipleRoots(jsx: string): boolean {
  let depth = 0
  let roots = 0
  let i = 0
  while (i < jsx.length) {
    if (jsx[i] === '<') {
      if (jsx[i + 1] === '/') {
        const end = jsx.indexOf('>', i)
        if (end === -1) break
        depth--
        i = end + 1
        if (depth === 0) roots++
        continue
      }
      const end = jsx.indexOf('>', i)
      if (end === -1) break
      if (jsx[end - 1] === '/') {
        if (depth === 0) roots++
        i = end + 1
      } else {
        depth++
        i = end + 1
      }
      if (roots > 1) return true
      continue
    }
    i++
  }
  return roots > 1
}

interface RenderJSXOptions {
  x?: number
  y?: number
  parentId?: string
}

/**
 * Render a JSX string into the scene graph.
 * Returns an array when the JSX contains multiple root elements.
 * Works in both Node/Bun and the browser.
 */
export async function renderJSX(
  graph: SceneGraph,
  jsxString: string,
  options?: RenderJSXOptions
): Promise<RenderResult[]> {
  const Component = buildComponent(jsxString)
  const element = React.createElement(Component, null)
  const tree = resolveToTree(element)

  if (!tree) {
    throw new Error('JSX must return a Figma element (Frame, Text, etc)')
  }

  if (tree.type === '' && tree.children.length > 0) {
    const results: RenderResult[] = []
    for (const child of tree.children) {
      if (typeof child === 'string') continue
      results.push(await renderTree(graph, child, options))
    }
    if (results.length === 0) {
      throw new Error('JSX must return a Figma element (Frame, Text, etc)')
    }
    return results
  }

  return [await renderTree(graph, tree, options)]
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
