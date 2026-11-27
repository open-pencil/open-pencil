import { omit } from 'es-toolkit/object'

import type {
  Fill,
  SceneGraph,
  SceneNode,
  StyleRun,
  TextBoundVariables
} from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'
import { applyVariableColor, paintBindingTarget } from '@open-pencil/scene-graph/variables'

import { characterStyles, styleRunsWithPatch, type CharacterStyle } from './style'

/** Characters next to each other that show the same fills with the same bindings. */
interface FillSegment {
  start: number
  end: number
  style: CharacterStyle
}

function fillSegments(node: SceneNode, start: number, end: number): FillSegment[] {
  const segments: FillSegment[] = []
  for (const [offset, style] of characterStyles(node, start, end).entries()) {
    const last = segments.at(-1)
    if (
      last &&
      last.style.fills === style.fills &&
      last.style.boundVariables === style.boundVariables
    ) {
      last.end = start + offset + 1
    } else {
      segments.push({ start: start + offset, end: start + offset + 1, style })
    }
  }
  return segments
}

/** The bindings of the layer's own fills' colours, which characters showing them take along. */
function layerFillBindings(node: SceneNode): TextBoundVariables {
  const bound: TextBoundVariables = {}
  for (const [field, variableId] of Object.entries(node.boundVariables)) {
    if (paintBindingTarget(field)?.list === 'fills') bound[field] = variableId
  }
  return bound
}

/**
 * The runs that bind the colour of fill `index` of `text[start, end)` to a variable, or unbind it
 * with `null`, as Figma binds a range's paint. Characters that show the layer's fills take them
 * as their own, with the layer's bindings of them, since a range's fills replace the layer's; a
 * newly bound paint shows the variable's colour for the text now.
 */
export function rangePaintBindingRuns(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number,
  index: number,
  variableId: string | null
): StyleRun[] {
  const field = `fills/${index}/color`
  const color = variableId ? graph.resolveColorVariableForNode(node.id, variableId) : null
  let styleRuns = node.styleRuns
  for (const segment of fillSegments(node, start, end)) {
    const layer = segment.style.fills === node.fills
    const fills = copyFills(segment.style.fills)
    const paint = fills.at(index)
    if (!paint) continue
    const bound = { ...(layer ? layerFillBindings(node) : {}), ...segment.style.boundVariables }
    if (variableId) {
      bound[field] = variableId
      if (color) applyVariableColor(paint, color)
    }
    const boundVariables = variableId ? bound : omit(bound, [field])
    styleRuns = styleRunsWithPatch({ ...node, styleRuns }, segment.start, segment.end, {
      fills,
      boundVariables: Object.keys(boundVariables).length > 0 ? boundVariables : undefined
    })
  }
  return styleRuns
}

/**
 * The runs that give `text[start, end)` `fills` of their own, each bound to the colour variable
 * `bindings` names by index, as Figma sets a range's paints: the bindings of the fills they
 * replace go with them, and a bound paint shows its variable's colour for the text now.
 */
export function rangeFillsRuns(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number,
  fills: Fill[],
  bindings: ReadonlyMap<number, string>
): StyleRun[] {
  const painted = copyFills(fills)
  for (const [index, variableId] of bindings) {
    const paint = painted.at(index)
    const color = graph.resolveColorVariableForNode(node.id, variableId)
    if (paint && color) applyVariableColor(paint, color)
  }
  let styleRuns = node.styleRuns
  for (const segment of fillSegments(node, start, end)) {
    const replaced = Object.keys(segment.style.boundVariables).filter(
      (field) => paintBindingTarget(field)?.list === 'fills'
    )
    const bound: TextBoundVariables = { ...omit(segment.style.boundVariables, replaced) }
    for (const [index, variableId] of bindings) bound[`fills/${index}/color`] = variableId
    styleRuns = styleRunsWithPatch({ ...node, styleRuns }, segment.start, segment.end, {
      fills: copyFills(painted),
      boundVariables: Object.keys(bound).length > 0 ? bound : undefined
    })
  }
  return styleRuns
}
