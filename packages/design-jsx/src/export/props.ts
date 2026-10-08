import {
  layoutSizing,
  type SceneGraph,
  type SceneNode,
  type NodeType
} from '@open-pencil/scene-graph'
import { DEFAULT_FONT_FAMILY } from '@open-pencil/scene-graph/constants'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text-direction'

import {
  collectCornerRadii,
  collectPadding,
  emitPadding,
  formatTracks,
  getNodeContext
} from './helpers'
import { collectEffectProps, collectFillProps, collectStrokeProps } from './paint'
import { collectStateProps } from './state'
import type { JSXProp } from './value'

export type { JSXProp } from './value'

/** The element that represents each node type; other types are not exported. */
export const NODE_TYPE_TO_TAG: Partial<Record<NodeType, string>> = {
  FRAME: 'Frame',
  RECTANGLE: 'Rectangle',
  ROUNDED_RECTANGLE: 'Rectangle',
  ELLIPSE: 'Ellipse',
  TEXT: 'Text',
  LINE: 'Line',
  STAR: 'Star',
  POLYGON: 'Polygon',
  VECTOR: 'Vector',
  GROUP: 'Group',
  SECTION: 'Section',
  COMPONENT: 'Component',
  COMPONENT_SET: 'Frame',
  INSTANCE: 'Frame'
}

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
  if (node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') {
    props.push(['blendMode', node.blendMode.toLowerCase()])
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

function collectTextNodeProps(node: SceneNode, props: JSXProp[]): void {
  const direction = resolveNodeTextDirection(node)
  if (node.fontSize !== 14) props.push(['size', node.fontSize])
  if (node.fontFamily && node.fontFamily !== DEFAULT_FONT_FAMILY)
    props.push(['font', node.fontFamily])
  if (node.fontWeight !== 400) {
    if (node.fontWeight === 700) props.push(['weight', 'bold'])
    else if (node.fontWeight === 500) props.push(['weight', 'medium'])
    else props.push(['weight', node.fontWeight])
  }
  if (direction === 'RTL') props.push(['dir', 'rtl'])
  if (node.italic) props.push(['italic', true])
  if (node.textAlignHorizontal !== 'LEFT') {
    props.push(['textAlign', node.textAlignHorizontal.toLowerCase()])
  }
  if (node.textAlignVertical !== 'TOP') {
    props.push(['textAlignVertical', node.textAlignVertical.toLowerCase()])
  }
  if (node.lineHeight != null) props.push(['lineHeight', node.lineHeight])
  if (node.letterSpacing !== 0) props.push(['letterSpacing', node.letterSpacing])
  if (node.textDecoration !== 'NONE')
    props.push(['textDecoration', node.textDecoration.toLowerCase()])
  if (node.textCase !== 'ORIGINAL') props.push(['textCase', node.textCase.toLowerCase()])
  if (node.maxLines != null) props.push(['maxLines', node.maxLines])
  if (node.textTruncation === 'ENDING' && node.maxLines == null) props.push(['truncate', true])
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

function collectShapeNodeProps(node: SceneNode, props: JSXProp[]): void {
  if (node.type === 'STAR') {
    if (node.pointCount !== 5) props.push(['points', node.pointCount])
    if (node.starInnerRadius !== 0.382) props.push(['innerRadius', node.starInnerRadius])
  }
  if (node.type === 'POLYGON' && node.pointCount !== 3) {
    props.push(['points', node.pointCount])
  }
}

/** The props of `node`, in the order they are printed. */
export function collectProps(node: SceneNode, graph: SceneGraph): JSXProp[] {
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
  collectStateProps(node, ctx, graph, props)

  return props
}
