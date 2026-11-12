import { isEqual, omitBy, pick } from 'es-toolkit'

import type { ArcData, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { DEFAULT_FONT_FAMILY } from '@open-pencil/scene-graph/constants'
import { layoutSizing } from '@open-pencil/scene-graph/layout'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text/direction'
import { vectorNetworkPaths } from '@open-pencil/scene-graph/vector-network'

import { BLEND_MODE, TEXT_ALIGN, TEXT_ALIGN_VERTICAL, TEXT_CASE, TEXT_DECORATION } from '../enums'
import { textLengthJSX } from '../overrides/text'
import { withPropertyBindings } from './components/properties'
import { componentReferences, type ComponentReference } from './components/references'
import { collectDecorationProps } from './decoration'
import { collectFontSettingProps, FONT_SETTING_FIELDS } from './font'
import {
  collectCornerRadii,
  collectPadding,
  emitPadding,
  formatTracks,
  getNodeContext
} from './helpers'
import { collectEffectProps, collectFillProps, collectStrokeProps } from './paints'
import { collectStateProps } from './state'
import type { JSXProp } from './value'
import { variableReferences, type VariableExport } from './variables'

export type { JSXProp } from './value'

/** The element that represents each node type; other types are not exported. */

function collectGridSizingProps(node: SceneNode, props: JSXProp[]): void {
  props.push(['grid', true])
  if (node.gridTemplateColumns.length > 0)
    props.push(['columns', formatTracks(node.gridTemplateColumns)])
  if (node.gridTemplateRows.length > 0) props.push(['rows', formatTracks(node.gridTemplateRows)])
  if (node.width > 0) props.push(['w', node.width])
  if (node.gridTemplateRows.length > 0 && node.height > 0) props.push(['h', node.height])
  if (node.gridColumnGap > 0) props.push(['columnGap', node.gridColumnGap])
  if (node.gridRowGap > 0) props.push(['rowGap', node.gridRowGap])
}

function collectFlexSizingProps(node: SceneNode, props: JSXProp[]): void {
  props.push(['flex', node.layoutMode === 'HORIZONTAL' ? 'row' : 'col'])
  if (node.layoutDirection === 'RTL') props.push(['dir', 'rtl'])
  const primaryAxis = node.layoutMode === 'HORIZONTAL' ? 'width' : 'height'
  const crossAxis = node.layoutMode === 'HORIZONTAL' ? 'height' : 'width'

  if (node.primaryAxisSizing !== 'HUG') {
    props.push([primaryAxis === 'width' ? 'w' : 'h', node[primaryAxis]])
  }
  if (node.counterAxisSizing !== 'HUG') {
    props.push([crossAxis === 'width' ? 'w' : 'h', node[crossAxis]])
  }
}

function collectGridPositionProps(node: SceneNode, props: JSXProp[]): void {
  if (!node.gridPosition) return
  const pos = node.gridPosition
  if (pos.column > 0) props.push(['colStart', pos.column])
  if (pos.row > 0) props.push(['rowStart', pos.row])
  if (pos.columnSpan > 1) props.push(['colSpan', pos.columnSpan])
  if (pos.rowSpan > 1) props.push(['rowSpan', pos.rowSpan])
}

function collectFlexAlignmentProps(node: SceneNode, props: JSXProp[]): void {
  if (node.itemSpacing > 0) props.push(['gap', node.itemSpacing])

  if (node.layoutWrap === 'WRAP') {
    props.push(['wrap', true])
    if (node.counterAxisSpacing > 0) props.push(['rowGap', node.counterAxisSpacing])
  }

  if (node.primaryAxisAlign === 'CENTER') props.push(['justify', 'center'])
  else if (node.primaryAxisAlign === 'MAX') props.push(['justify', 'end'])
  else if (node.primaryAxisAlign === 'SPACE_BETWEEN') props.push(['justify', 'between'])

  if (node.counterAxisAlign === 'CENTER') props.push(['items', 'center'])
  else if (node.counterAxisAlign === 'MAX') props.push(['items', 'end'])
  else if (node.counterAxisAlign === 'STRETCH') props.push(['items', 'stretch'])
  else if (node.counterAxisAlign === 'BASELINE') props.push(['items', 'baseline'])
}

function collectAutoLayoutPaddingProps(node: SceneNode, props: JSXProp[]): void {
  const pad = collectPadding(node)
  if (!pad) return
  props.push(
    ...emitPadding(
      pad,
      (v) => ['p', v] as JSXProp,
      (y, x) =>
        [
          ['py', y],
          ['px', x]
        ] as JSXProp[],
      ({ pt, pr, pb, pl }) => {
        const r: JSXProp[] = []
        if (pt > 0) r.push(['pt', pt])
        if (pr > 0) r.push(['pr', pr])
        if (pb > 0) r.push(['pb', pb])
        if (pl > 0) r.push(['pl', pl])
        return r
      }
    )
  )
}

function collectCornerRadiiProps(node: SceneNode, props: JSXProp[]): void {
  const corners = collectCornerRadii(node)
  if (!corners) return
  const { tl, tr, br, bl } = corners
  if (tl === tr && tr === br && br === bl) {
    props.push(['rounded', tl])
  } else {
    if (tl > 0) props.push(['roundedTL', tl])
    if (tr > 0) props.push(['roundedTR', tr])
    if (br > 0) props.push(['roundedBR', br])
    if (bl > 0) props.push(['roundedBL', bl])
  }
}

function collectAppearanceProps(node: SceneNode, props: JSXProp[]): void {
  collectFillProps(node, props)
  collectStrokeProps(node, props)
  collectCornerRadiiProps(node, props)

  if (node.cornerSmoothing > 0) props.push(['cornerSmoothing', node.cornerSmoothing])
  if (node.opacity < 1) props.push(['opacity', Math.round(node.opacity * 100) / 100])
  if (node.rotation !== 0) props.push(['rotate', Math.round(node.rotation * 100) / 100])
  if (node.flipX) props.push(['flipX', true])
  if (node.flipY) props.push(['flipY', true])
  if (node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') {
    props.push(['blendMode', BLEND_MODE.print(node.blendMode)])
  }
  if (node.clipsContent) props.push(['overflow', 'hidden'])
  collectEffectProps(node, props)
}

function collectPositionProps(
  node: SceneNode,
  ctx: ReturnType<typeof getNodeContext>,
  props: JSXProp[]
): void {
  if (ctx.parentIsAutoLayout || ctx.parentIsGrid) {
    // Absolute children of a layout keep their position; the rest are placed by it.
    if (node.layoutPositioning !== 'ABSOLUTE') return
    props.push(['position', 'absolute'], ['x', node.x], ['y', node.y])
    return
  }
  if (node.x !== 0) props.push(['x', node.x])
  if (node.y !== 0) props.push(['y', node.y])
}

/** A layer's opacity and whether it is hidden, for an element that writes its own props. */
export function presenceProps(node: SceneNode): JSXProp[] {
  const props: JSXProp[] = []
  if (node.opacity < 1) props.push(['opacity', Math.round(node.opacity * 100) / 100])
  if (!node.visible) props.push(['visible', false])
  return props
}

/** Where a layer sits in its parent, as the export writes any layer's position. */
export function positionProps(node: SceneNode, graph: SceneGraph): JSXProp[] {
  const props: JSXProp[] = []
  collectPositionProps(node, getNodeContext(node, graph), props)
  return props
}

function collectSizingProps(
  node: SceneNode,
  ctx: ReturnType<typeof getNodeContext>,
  graph: SceneGraph,
  props: JSXProp[]
): void {
  if (ctx.isGrid) collectGridSizingProps(node, props)
  else if (ctx.isFlex) collectFlexSizingProps(node, props)
  else if (node.type === 'TEXT') collectTextSizingProps(node, graph, props)
  else {
    if (node.width > 0) props.push(['w', node.width])
    if (node.height > 0) props.push(['h', node.height])
  }

  if (!ctx.parentIsAutoLayout) return
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  // A flex child's main-axis fill keeps its grow factor; every other fill is `"fill"`.
  const growAxis = parent?.layoutMode === 'VERTICAL' ? 'VERTICAL' : 'HORIZONTAL'
  const keepsGrow = parent?.layoutMode !== 'GRID' && node.layoutGrow > 0
  if (keepsGrow) props.push(['grow', node.layoutGrow])
  for (const [axis, key] of [
    ['HORIZONTAL', 'w'],
    ['VERTICAL', 'h']
  ] as const) {
    if (keepsGrow && axis === growAxis) continue
    if (layoutSizing(graph, node, axis) !== 'FILL') continue
    // Stretch inherited from the parent's alignment is written on the parent.
    if (axis !== growAxis && node.layoutAlignSelf !== 'STRETCH') continue
    // Fill replaces the size the node had before it filled.
    const index = props.findIndex(([k]) => k === key)
    if (index === -1) props.push([key, 'fill'])
    else props[index] = [key, 'fill']
  }
}

function collectTextSizingProps(node: SceneNode, graph: SceneGraph, props: JSXProp[]): void {
  const autoResize = node.textAutoResize
  const emitH = autoResize === 'NONE' || autoResize === 'TRUNCATE'
  // Don't emit fixed w when text stretches to fill parent — the layoutAlignSelf
  // check below will emit w="fill" instead. Without this guard, w={computedPx}
  // gets emitted first and blocks the fill detection.
  const isFillWidth =
    node.layoutAlignSelf === 'STRETCH' &&
    (() => {
      const parent = node.parentId ? graph.getNode(node.parentId) : null
      return parent?.layoutMode === 'VERTICAL'
    })()
  const isGrowWidth =
    node.layoutGrow > 0 &&
    (() => {
      const parent = node.parentId ? graph.getNode(node.parentId) : null
      return parent?.layoutMode === 'HORIZONTAL'
    })()
  const emitW = autoResize !== 'WIDTH_AND_HEIGHT' && !isFillWidth && !isGrowWidth
  if (emitW && node.width > 0) props.push(['w', node.width])
  if (emitH && node.height > 0) props.push(['h', node.height])
}

const DECORATION_FIELDS = [
  'textDecorationStyle',
  'textDecorationFills',
  'textDecorationThickness',
  'textUnderlineOffset',
  'textDecorationSkipInk'
] as const

const TEXT_DEFAULTS = pick(
  createDefaultNode(() => '', 'TEXT'),
  [...DECORATION_FIELDS, ...FONT_SETTING_FIELDS]
)

/** The fields of `node` that differ from a new text's. */
function ownTextFields<K extends keyof typeof TEXT_DEFAULTS>(
  node: SceneNode,
  fields: readonly K[]
) {
  return omitBy(pick(node, fields), (value, key) => isEqual(value, TEXT_DEFAULTS[key]))
}

/** A text's font settings, and whether its optical size follows the font size. */
function collectTextFontSettingProps(node: SceneNode, props: JSXProp[]): void {
  collectFontSettingProps(ownTextFields(node, FONT_SETTING_FIELDS), props)
  if (!node.opticalSizeFromFontSize) props.push(['fontOpticalSizing', 'none'])
}

/** A font weight as `weight` writes it, by name for the weights that have one. */
export function fontWeightValue(weight: number): string | number {
  if (weight === 700) return 'bold'
  if (weight === 500) return 'medium'
  return weight
}

function collectTextNodeProps(node: SceneNode, props: JSXProp[]): void {
  const direction = resolveNodeTextDirection(node)
  if (node.fontSize !== 14) props.push(['size', node.fontSize])
  if (node.fontFamily && node.fontFamily !== DEFAULT_FONT_FAMILY)
    props.push(['font', node.fontFamily])
  if (node.fontWeight !== 400) props.push(['weight', fontWeightValue(node.fontWeight)])
  if (direction === 'RTL') props.push(['dir', 'rtl'])
  if (node.italic) props.push(['italic', true])
  if (node.textAlignHorizontal !== 'LEFT') {
    props.push(['textAlign', TEXT_ALIGN.print(node.textAlignHorizontal)])
  }
  if (node.textAlignVertical !== 'TOP') {
    props.push(['textAlignVertical', TEXT_ALIGN_VERTICAL.print(node.textAlignVertical)])
  }
  if (node.lineHeight != null) props.push(['lineHeight', textLengthJSX(node.lineHeight)])
  if (node.letterSpacing.value !== 0) {
    props.push(['letterSpacing', textLengthJSX(node.letterSpacing)])
  }
  if (node.textDecoration !== 'NONE')
    props.push(['textDecoration', TEXT_DECORATION.print(node.textDecoration)])
  collectDecorationProps(ownTextFields(node, DECORATION_FIELDS), node, props)
  collectTextFontSettingProps(node, props)
  if (node.textCase !== 'ORIGINAL') props.push(['textCase', TEXT_CASE.print(node.textCase)])
  if (node.maxLines != null) props.push(['maxLines', node.maxLines])
  if (node.textTruncation === 'ENDING' && node.maxLines == null) props.push(['truncate', true])
  if (node.paragraphSpacing !== 0) props.push(['paragraphSpacing', node.paragraphSpacing])
  if (node.listSpacing !== 0) props.push(['listSpacing', node.listSpacing])
  if (node.paragraphIndent !== 0) props.push(['paragraphIndent', node.paragraphIndent])
  if (node.hangingList) props.push(['hangingList', true])
}

const TEXT_AUTO_RESIZE: Record<SceneNode['textAutoResize'], string> = {
  NONE: 'none',
  WIDTH_AND_HEIGHT: 'width',
  HEIGHT: 'height',
  TRUNCATE: 'truncate'
}

/** The renderer infers auto-resize from the width props; say so only when it differs. */
function collectTextAutoResizeProp(
  node: SceneNode,
  ctx: ReturnType<typeof getNodeContext>,
  props: JSXProp[]
): void {
  const hasWidth = props.some(([key]) => key === 'w')
  const grows = ctx.parentIsAutoLayout && node.layoutGrow > 0
  const inferred = hasWidth || grows ? 'HEIGHT' : 'WIDTH_AND_HEIGHT'
  if (node.textAutoResize !== inferred) {
    props.push(['textAutoResize', TEXT_AUTO_RESIZE[node.textAutoResize]])
  }
}

const roundDegrees = (radians: number) => Math.round(((radians * 180) / Math.PI) * 10_000) / 10_000

/** An ellipse's arc, written only where it is not a whole ellipse. */
function collectArcProps(arc: ArcData | null, props: JSXProp[]): void {
  if (!arc) return
  const start = roundDegrees(arc.startingAngle)
  const end = roundDegrees(arc.endingAngle)
  if (start !== 0) props.push(['startAngle', start])
  // A whole turn from the start is the default end.
  if (Math.abs(end - (start + 360)) > 1e-6) props.push(['endAngle', end])
  if (arc.innerRadius !== 0) props.push(['innerRadius', arc.innerRadius])
}

function collectShapeNodeProps(node: SceneNode, props: JSXProp[]): void {
  if (node.type === 'ELLIPSE') collectArcProps(node.arcData, props)
  if (node.type === 'STAR') {
    if (node.pointCount !== 5) props.push(['points', node.pointCount])
    if (node.starInnerRadius !== 0.382) props.push(['innerRadius', node.starInnerRadius])
  }
  if (node.type === 'POLYGON' && node.pointCount !== 3) {
    props.push(['points', node.pointCount])
  }
  if (node.type === 'VECTOR' && node.vectorNetwork) {
    // Figma's own form of a vector's geometry, which <Vector> reads back as written.
    const paths = vectorNetworkPaths(node.vectorNetwork)
    if (paths.length > 0) props.push(['paths', paths.map((path) => ({ ...path }))])
  }
}

/**
 * The props of `node`, in the order they are printed, with the variables it binds written as
 * `variables` writes them: by default, by reference to the document's. Components are named as
 * `reference` names them.
 */
export function collectProps(
  node: SceneNode,
  graph: SceneGraph,
  variables: VariableExport = variableReferences(graph),
  reference: ComponentReference = componentReferences(graph)
): JSXProp[] {
  const props: JSXProp[] = []
  const ctx = getNodeContext(node, graph)

  if (node.name && node.name !== node.type) props.push(['name', node.name])

  collectPositionProps(node, ctx, props)
  collectSizingProps(node, ctx, graph, props)
  if (ctx.parentIsGrid) collectGridPositionProps(node, props)
  if (ctx.isFlex) collectFlexAlignmentProps(node, props)
  if (ctx.isAutoLayout) collectAutoLayoutPaddingProps(node, props)
  collectAppearanceProps(node, props)
  if (node.type === 'TEXT') {
    collectTextNodeProps(node, props)
    collectTextAutoResizeProp(node, ctx, props)
  }
  collectShapeNodeProps(node, props)
  collectStateProps(node, ctx, props, variables)

  return withPropertyBindings(props, node, graph, reference)
}
