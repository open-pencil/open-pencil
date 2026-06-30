import { transform } from 'sucrase'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { RenderOptions as RenderJSXOptions } from '#core/design-jsx/types'

import { backgroundBlur, dropShadow, foregroundBlur, innerShadow, layerBlur } from './effects'
import * as React from './mini-react'
import {
  angularGradient,
  diamondGradient,
  gradient,
  linearGradient,
  radialGradient,
  solid
} from './paints'
import { renderTree, type RenderResult } from './renderer'
import { isTreeNode, resolveToTree, type TreeNode } from './tree'

/**
 * Build a component function from a JSX string using sucrase.
 * Works in both Node/Bun and the browser (no native bindings).
 */
const SUPPORTED_PROPS = new Set([
  'name',
  'key',
  'flex',
  'flow',
  'dir',
  'gap',
  'wrap',
  'rowGap',
  'columnGap',
  'justify',
  'justifyContent',
  'items',
  'align',
  'alignItems',
  'grow',
  'w',
  'h',
  'width',
  'height',
  'minW',
  'maxW',
  'minH',
  'maxH',
  'x',
  'y',
  'top',
  'left',
  'position',
  'p',
  'padding',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'bg',
  'fill',
  'fills',
  'background',
  'backgroundColor',
  'stroke',
  'border',
  'borderColor',
  'strokeWidth',
  'borderWidth',
  'strokeAlign',
  'strokeDash',
  'rounded',
  'borderRadius',
  'roundedTL',
  'roundedTR',
  'roundedBL',
  'roundedBR',
  'cornerRadius',
  'cornerSmoothing',
  'opacity',
  'blendMode',
  'rotate',
  'rotation',
  'overflow',
  'shadow',
  'blur',
  'effects',
  'size',
  'fontSize',
  'font',
  'fontFamily',
  'weight',
  'fontWeight',
  'color',
  'text',
  'characters',
  'content',
  'value',
  'title',
  'textAlign',
  'textAlignHorizontal',
  'textHorizontalAlignment',
  'textAlignVertical',
  'textVerticalAlignment',
  'textAutoResize',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase',
  'maxLines',
  'truncate',
  'grid',
  'columns',
  'rows',
  'colStart',
  'rowStart',
  'col',
  'row',
  'colSpan',
  'rowSpan',
  'points',
  'pointCount',
  'innerRadius',
  'label',
  'style',
  'bind',
  'component',
  'componentId',
  'of'
])

function stripHtmlComments(jsxString: string): string {
  return jsxString.replace(/<!--[\s\S]*?-->/g, '')
}

function unsupportedPropWarnings(tree: TreeNode): string[] {
  const warnings: string[] = []
  collectUnsupportedPropWarnings(tree, warnings)
  return warnings
}

function collectUnsupportedPropWarnings(tree: TreeNode, warnings: string[]): void {
  for (const key of Object.keys(tree.props)) {
    if (!SUPPORTED_PROPS.has(key)) {
      warnings.push(`Unsupported prop "${key}" on <${tree.type}> is ignored.`)
    }
  }
  for (const child of tree.children) {
    if (isTreeNode(child)) collectUnsupportedPropWarnings(child, warnings)
  }
}

export function buildComponent(jsxString: string): React.ComponentType {
  const trimmed = stripHtmlComments(jsxString).trim()

  const aliases = `
    const __h = React.createElement
    const __frag = ''
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    const Component = 'component', ComponentSet = 'component-set', Instance = 'instance'
    const Icon = 'icon'
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
  return new Function('React', '__helpers', code)(React, {
    backgroundBlur,
    dropShadow,
    foregroundBlur,
    innerShadow,
    layerBlur,
    angularGradient,
    diamondGradient,
    gradient,
    linearGradient,
    radialGradient,
    solid
  }) as React.ComponentType
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

  const warnings = unsupportedPropWarnings(tree)

  if (tree.type === '' && tree.children.length > 0) {
    const results: RenderResult[] = []
    for (const child of tree.children) {
      if (typeof child === 'string') continue
      results.push(await renderTree(graph, child, options))
    }
    if (results.length === 0) {
      throw new Error('JSX must return a Figma element (Frame, Text, etc)')
    }
    if (warnings.length > 0) results[0].warnings = warnings
    return results
  }

  const result = await renderTree(graph, tree, options)
  if (warnings.length > 0) result.warnings = warnings
  return [result]
}

export { renderTree as renderTreeNode }
