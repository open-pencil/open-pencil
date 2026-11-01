import { uniq } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { REKA_ELEMENTS } from '../behaviours'
import { componentPropNames } from '../components/instances'
import { elementBindings, elementProps, elementSchema } from '../elements'
import { ENUM_PROPS } from '../enums'
import { DESIGN_JSX_HELPERS, designJSXHelpers } from '../helpers'
import * as React from '../mini-react'
import { elementPropWarnings } from '../schema'
import type { DesignJSXServices } from '../services'
import { TEXT_CONTENT_NAMES } from '../text-content'
import { transformDesignJSXExpression } from '../transform'
import { isTreeNode, resolveToTree, type TreeNode } from '../tree'
import { renderRoots, renderTree, type RenderResult } from './roots'
import type { RenderOptions as RenderJSXOptions } from './types'

/** `const Switch = { Root: 'Switch.Root', … }`: each Reka namespace as element types. */
const REKA_ALIASES = Object.entries(REKA_ELEMENTS)
  .map(
    ([namespace, parts]) =>
      `const ${namespace} = ${JSON.stringify(
        Object.fromEntries(Object.keys(parts).map((part) => [part, `${namespace}.${part}`]))
      )}`
  )
  .join('\n')

/** `const solid = __helpers.solid`, …: every helper in the scope of the code. */
const HELPER_BINDINGS = DESIGN_JSX_HELPERS.map(
  ({ name }) => `const ${name} = __helpers.${name}`
).join('\n')

function stripHTMLComments(jsxString: string): string {
  return jsxString.replace(/<!--[\s\S]*?-->/g, '')
}

function unsupportedPropWarnings(
  graph: SceneGraph,
  tree: TreeNode,
  rendered: ReadonlyMap<TreeNode, SceneNode>
): string[] {
  const warnings: string[] = []
  collectUnsupportedPropWarnings(graph, tree, rendered, warnings)
  return warnings
}

function collectUnsupportedPropWarnings(
  graph: SceneGraph,
  tree: TreeNode,
  rendered: ReadonlyMap<TreeNode, SceneNode>,
  warnings: string[]
): void {
  const supported = elementProps(tree.type)
  // An instance sets its component's properties by name, such as `State="On"` or `Title="Hi"`.
  const properties = componentPropNames(graph, tree.props, rendered.get(tree))
  const element = TEXT_CONTENT_NAMES[tree.type] ?? tree.type
  const schema = elementSchema(tree.type)
  if (schema) warnings.push(...elementPropWarnings(schema, tree.props, element))
  for (const [key, value] of Object.entries(tree.props)) {
    if (!supported.has(key) && !properties.includes(key)) {
      warnings.push(`Unsupported prop "${key}" on <${element}> is ignored.`)
      continue
    }
    const values = ENUM_PROPS[key]
    if (values && typeof value === 'string' && values.parse(value) === undefined) {
      warnings.push(
        `Unknown ${key} "${value}" on <${element}> is ignored; expected ${values.names.join(', ')}.`
      )
    }
  }

  // SVG descendants are parsed as markup by renderSvgNode, not as Design JSX nodes.
  if (tree.type === 'svg') return

  for (const child of tree.children) {
    if (isTreeNode(child)) collectUnsupportedPropWarnings(graph, child, rendered, warnings)
  }
}

/**
 * Build a component function from a JSX string: one JSX expression, sibling elements, or
 * statements that end with `return` and the JSX. The statements run inside the component, so
 * they may shadow an element or helper name. Works in both Node/Bun and the browser.
 */
export function buildComponent(jsxString: string, warnings: string[] = []): React.ComponentType {
  const trimmed = stripHTMLComments(jsxString).trim()

  const aliases = `
    const __h = React.createElement
    const __fragment = ''
    ${elementBindings()}
    const svg = 'svg'
    ${REKA_ALIASES}
    ${HELPER_BINDINGS}
  `

  const body = transformDesignJSXExpression(trimmed)
  // eslint-disable-next-line typescript-eslint/no-implied-eval -- sucrase output must be evaluated at runtime
  return new Function('React', '__helpers', `${aliases}\nreturn function __render() {\n${body}\n}`)(
    React,
    designJSXHelpers(warnings)
  ) as React.ComponentType
}

/**
 * Render a JSX string into the scene graph.
 * Works in both Node/Bun and the browser.
 */
async function renderJSX<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  jsxString: string,
  options?: RenderJSXOptions
): Promise<RenderResult[]> {
  const helperWarnings: string[] = []
  const Component = buildComponent(jsxString, helperWarnings)
  const element = React.createElement(Component, null)
  const tree = resolveToTree(element)

  if (!tree) {
    throw new Error('JSX must return a Figma element (Frame, Text, etc)')
  }

  const rendered = new Map<TreeNode, SceneNode>()
  const results = await renderRoots(services, graph, tree, {
    ...options,
    onNode: (element, node) => {
      rendered.set(element, node)
      options?.onNode?.(element, node)
    }
  })
  // After rendering, so an instance's component set drawn in the same JSX names its variants.
  // A helper called in a loop reports each ignored option once.
  // Prop warnings come first, then the render's own, such as a connector end naming no layer.
  const warnings = uniq([
    ...unsupportedPropWarnings(graph, tree, rendered),
    ...helperWarnings,
    ...(results[0].warnings ?? [])
  ])
  if (warnings.length > 0) results[0].warnings = warnings
  return results
}

/**
 * A Design JSX renderer bound to an engine. Rendering needs `services` for icons, inline
 * SVG, and layout; OpenPencil's engine provides them through `@open-pencil/core/design-jsx`.
 */
export function createDesignJSXRenderer<Artwork>(services: DesignJSXServices<Artwork>) {
  return {
    /** Render a Design JSX string into the graph, one result per top-level element. */
    renderJSX: (graph: SceneGraph, jsxString: string, options?: RenderJSXOptions) =>
      renderJSX(services, graph, jsxString, options),
    /** Render a tree built with the element functions into the graph. */
    renderTree: (graph: SceneGraph, tree: TreeNode, options?: RenderJSXOptions) =>
      renderTree(services, graph, tree, options),
    /** Render every root of a tree, components before the roots that use them. */
    renderRoots: (graph: SceneGraph, tree: TreeNode, options?: RenderJSXOptions) =>
      renderRoots(services, graph, tree, options)
  }
}

export type DesignJSXRenderer = ReturnType<typeof createDesignJSXRenderer>
