import { uniq } from 'es-toolkit/array'
import { transform } from 'sucrase'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { REKA_ELEMENTS } from './behaviours'
import { designJSXHelpers } from './helpers'
import * as React from './mini-react'
import { renderRoots, renderTree, type RenderResult } from './renderer'
import { DESIGN_JSX_SUPPORTED_PROPERTIES } from './schema'
import type { DesignJSXServices } from './services'
import { isTreeNode, resolveToTree, type TreeNode } from './tree'
import type { RenderOptions as RenderJSXOptions } from './types'

/**
 * Build a component function from a JSX string using sucrase.
 * Works in both Node/Bun and the browser (no native bindings).
 */
const SUPPORTED_PROPS = DESIGN_JSX_SUPPORTED_PROPERTIES

/** `const Switch = { Root: 'Switch.Root', … }`: each Reka namespace as element types. */
const REKA_ALIASES = Object.entries(REKA_ELEMENTS)
  .map(
    ([namespace, parts]) =>
      `const ${namespace} = ${JSON.stringify(
        Object.fromEntries(Object.keys(parts).map((part) => [part, `${namespace}.${part}`]))
      )}`
  )
  .join('\n')

function stripHTMLComments(jsxString: string): string {
  return jsxString.replace(/<!--[\s\S]*?-->/g, '')
}

function unsupportedPropWarnings(tree: TreeNode): string[] {
  const warnings: string[] = []
  collectUnsupportedPropWarnings(tree, warnings)
  return warnings
}

const SVG_ROOT_PROPS = new Set([...SUPPORTED_PROPS, 'viewBox', 'body'])

function collectUnsupportedPropWarnings(tree: TreeNode, warnings: string[]): void {
  const supportedProps = tree.type === 'svg' ? SVG_ROOT_PROPS : SUPPORTED_PROPS
  for (const key of Object.keys(tree.props)) {
    if (!supportedProps.has(key)) {
      warnings.push(`Unsupported prop "${key}" on <${tree.type}> is ignored.`)
    }
  }

  // SVG descendants are parsed as markup by renderSvgNode, not as Design JSX nodes.
  if (tree.type === 'svg') return

  for (const child of tree.children) {
    if (isTreeNode(child)) collectUnsupportedPropWarnings(child, warnings)
  }
}

export function buildComponent(jsxString: string, warnings: string[] = []): React.ComponentType {
  const trimmed = stripHTMLComments(jsxString).trim()

  const aliases = `
    const __h = React.createElement
    const __frag = ''
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    const Component = 'component', ComponentSet = 'component-set', Instance = 'instance'
    const Icon = 'icon'
    const svg = 'svg'
    ${REKA_ALIASES}
    const dropShadow = __helpers.dropShadow
    const innerShadow = __helpers.innerShadow
    const layerBlur = __helpers.layerBlur
    const backgroundBlur = __helpers.backgroundBlur
    const foregroundBlur = __helpers.foregroundBlur
    const solid = __helpers.solid
    const gradient = __helpers.gradient
    const linearGradient = __helpers.linearGradient
    const radialGradient = __helpers.radialGradient
    const angularGradient = __helpers.angularGradient
    const diamondGradient = __helpers.diamondGradient
    const __varSymbol = Symbol.for('open-pencil.variable')
    const designVar = (def, value) => typeof def === 'string'
      ? ({ [__varSymbol]: true, id: def, name: def, value })
      : ({ [__varSymbol]: true, id: def.id, name: def.name ?? def.id ?? '', value: def.value })
    const defineVars = (vars) => Object.fromEntries(
      Object.entries(vars).map(([key, def]) => [key, designVar(def)])
    )
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
  return new Function('React', '__helpers', code)(
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

  // A helper called in a loop reports each ignored option once.
  const warnings = uniq([...unsupportedPropWarnings(tree), ...helperWarnings])

  const results = await renderRoots(services, graph, tree, options)
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
      renderTree(services, graph, tree, options)
  }
}

export type DesignJSXRenderer = ReturnType<typeof createDesignJSXRenderer>
