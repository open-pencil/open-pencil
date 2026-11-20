import type {
  ColorProfile,
  SceneGraph,
  SceneNode,
  Variable,
  VariableAlias,
  VariableFormulaNode,
  VariableValue
} from '@open-pencil/scene-graph'
import { convertColor } from '@open-pencil/scene-graph/color'
import { mapNodeColors, mapPaintColors, type NodeColorFields } from '@open-pencil/scene-graph/copy'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { getPageBackgrounds, pageSourceWithBackgrounds } from '#core/figma-api/page-backgrounds'
import { reconcileVariableLayouts } from '#core/layout/variables'

import type { EditorContext } from './types'

/**
 * How a document takes another color profile, as Figma's File color profile dialog offers it:
 * `assign` keeps every stored number and reads it in the new profile, so colors change; `convert`
 * rewrites the numbers so colors look the same, mapping those the new profile cannot show to the
 * nearest it can.
 */
export type DocumentColorProfileMode = 'assign' | 'convert'

type ConvertColor = (color: Color) => Color

/**
 * The stored colors a conversion changes, as they were before it: redoing converts them again,
 * since converting is deterministic, so only one copy of each is kept.
 */
interface ColorsBefore {
  layers: Map<string, NodeColorFields>
  pages: Map<string, SceneNode['source']>
  variables: Map<string, Variable['valuesByMode']>
}

function isColorValue(value: VariableValue | VariableFormulaNode): value is Color {
  return typeof value === 'object' && 'r' in value
}

function isAlias(value: VariableFormulaNode): value is VariableAlias {
  return typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS'
}

/** A formula's literal colors converted, its aliases and other operands as they were. */
function convertFormulaNode(node: VariableFormulaNode, convert: ConvertColor): VariableFormulaNode {
  if (isColorValue(node)) return convert(node)
  if (typeof node !== 'object' || isAlias(node)) return node
  return { ...node, operands: node.operands.map((operand) => convertFormulaNode(operand, convert)) }
}

/** A color variable's value with its literal colors converted, inside expressions too. */
function convertVariableValue(value: VariableValue, convert: ConvertColor): VariableValue {
  if (isColorValue(value)) return convert(value)
  if (typeof value !== 'object' || !('expression' in value)) return value
  if (value.expression === 'COMPOSE_COLOR') {
    return isColorValue(value.color) ? { ...value, color: convert(value.color) } : value
  }
  if (value.expression === 'FORMULA') {
    return { ...value, value: convertFormulaNode(value.value, convert) }
  }
  return value
}

/** Every stored color in `graph` as it is now: layers' color fields, pages, and color variables. */
function colorsBefore(graph: SceneGraph): ColorsBefore {
  const before: ColorsBefore = { layers: new Map(), pages: new Map(), variables: new Map() }
  for (const node of graph.getAllNodes()) {
    if (node.type === 'CANVAS') {
      before.pages.set(node.id, structuredClone(node.source))
      continue
    }
    const fields = mapNodeColors(node, (color) => ({ ...color }))
    if (fields) before.layers.set(node.id, fields)
  }
  for (const variable of graph.variables.values()) {
    if (variable.type === 'COLOR') {
      before.variables.set(variable.id, structuredClone(variable.valuesByMode))
    }
  }
  return before
}

/** Writes the colors in `before`, converted through `convert` when given, back into `graph`. */
function writeColors(graph: SceneGraph, before: ColorsBefore, convert: ConvertColor | null) {
  for (const [id, fields] of before.layers) {
    if (!graph.getNode(id)) continue
    graph.updateNode(id, mapNodeColors(fields, convert ?? ((color) => ({ ...color }))) ?? {})
  }
  for (const [id, source] of before.pages) {
    const page = graph.getNode(id)
    if (!page) continue
    if (!convert) {
      graph.updateNode(id, { source: structuredClone(source) })
      continue
    }
    const backgrounds = getPageBackgrounds({ ...page, source }).map((fill) =>
      mapPaintColors(fill, convert)
    )
    graph.updateNode(id, { source: pageSourceWithBackgrounds({ ...page, source }, backgrounds) })
  }
  for (const [id, values] of before.variables) {
    const variable = graph.variables.get(id)
    if (!variable) continue
    graph.willChangeVariable(id)
    variable.valuesByMode = convert
      ? Object.fromEntries(
          Object.entries(values).map(([mode, value]) => [
            mode,
            convertVariableValue(value, convert)
          ])
        )
      : structuredClone(values)
  }
  reconcileVariableLayouts(graph, { variables: [...before.variables.keys()] })
}

export function createColorSpaceActions(
  ctx: EditorContext,
  loadPageNodes: (pageId: string) => Promise<void>
) {
  function setProfile(space: ColorProfile) {
    ctx.graph.documentColorSpace = space
    ctx.emitEditorEvent('document:color-space-changed', space)
    ctx.requestRender()
  }

  /**
   * Gives the document `colorSpace` as one undo step. Assigning keeps every value; converting
   * rewrites every stored color so it looks the same: layers' paints, effects, text runs, layout
   * grids, and vector regions, page backgrounds, and color variables, on every page, loading
   * the pages not opened yet first so none keeps values in the old profile.
   */
  async function setDocumentColorSpace(
    colorSpace: ColorProfile,
    mode: DocumentColorProfileMode = 'assign'
  ): Promise<void> {
    const graph = ctx.graph
    const previous = graph.documentColorSpace
    if (previous === colorSpace) return
    if (mode === 'assign') {
      setProfile(colorSpace)
      ctx.undo.push({
        label: 'Assign color profile',
        forward: () => setProfile(colorSpace),
        inverse: () => setProfile(previous)
      })
      return
    }

    await Promise.all(graph.getPages().map((page) => loadPageNodes(page.id)))
    // The document may have been closed, replaced, or converted while its pages loaded.
    if (ctx.graph !== graph || graph.documentColorSpace !== previous) return
    const before = colorsBefore(graph)
    const convert: ConvertColor = (color) => convertColor(color, previous, colorSpace, 'map')
    const forward = () => {
      writeColors(graph, before, convert)
      setProfile(colorSpace)
    }
    forward()
    ctx.undo.push({
      label: 'Convert color profile',
      forward,
      inverse: () => {
        writeColors(graph, before, null)
        setProfile(previous)
      }
    })
  }

  return {
    setDocumentColorSpace
  }
}
