import { transform } from 'sucrase'

import type { SceneGraph } from '#core/scene-graph'

import * as React from './mini-react'
import { renderTree, type RenderResult } from './renderer'
import { resolveToTree, type TreeNode } from './tree'

/**
 * Build a component function from a JSX string using sucrase.
 * Works in both Node/Bun and the browser (no native bindings).
 */
export function buildComponent(jsxString: string): React.ComponentType {
  const trimmed = jsxString.trim()

  const aliases = `
    const __h = React.createElement
    const __frag = ''
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    const Component = 'component', Instance = 'frame'
    const Icon = 'icon'
  `
  const opts = {
    transforms: ['typescript', 'jsx'] as Array<'typescript' | 'jsx'>,
    jsxPragma: '__h',
    jsxFragmentPragma: '__frag',
    production: true
  }

  let code: string
  try {
    code = transform(`${aliases}\nreturn function __render() { return ${trimmed} }`, opts).code
  } catch {
    code = transform(`${aliases}\nreturn function __render() { return <>${trimmed}</> }`, opts).code
  }

  // eslint-disable-next-line typescript-eslint/no-implied-eval -- sucrase output must be evaluated at runtime
  return new Function('React', code)(React) as React.ComponentType
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
