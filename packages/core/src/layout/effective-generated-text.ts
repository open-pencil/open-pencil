import type { SceneGraph, SceneNode, Size } from '@open-pencil/scene-graph'

import { getTextMeasurer } from './text-measurement'

type LayoutAxis = 'width' | 'height'

const MIN_EFFECTIVE_TEXT_WIDTH_CHANGE = 1.5
const MAX_STRETCHED_TEXT_WIDTH_CHANGE = 8
const MAX_COMPONENT_LINEAGE_DEPTH = 20

function axisSizing(node: SceneNode, axis: LayoutAxis): SceneNode['primaryAxisSizing'] {
  const isPrimary =
    (node.layoutMode === 'HORIZONTAL' && axis === 'width') ||
    (node.layoutMode === 'VERTICAL' && axis === 'height')
  return isPrimary ? node.primaryAxisSizing : node.counterAxisSizing
}

function canResizeIntrinsicAxis(node: SceneNode, axis: LayoutAxis): boolean {
  return (
    axisSizing(node, axis) === 'HUG' ||
    (node.source.format === 'fig' && node.derivedLayout?.[axis] === undefined)
  )
}

function terminalTextSource(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  let current = node
  for (let depth = 0; current.componentId && depth < MAX_COMPONENT_LINEAGE_DEPTH; depth++) {
    const source = graph.getNode(current.componentId)
    if (!source) break
    current = source
  }
  return current.type === 'TEXT' ? current : undefined
}

function parentHugsWidth(graph: SceneGraph, node: SceneNode): boolean {
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  return parent !== undefined && axisSizing(parent, 'width') === 'HUG'
}

function hasFixedWidthTextAncestor(graph: SceneGraph, node: SceneNode): boolean {
  let current = node
  for (let depth = 0; current.componentId && depth < MAX_COMPONENT_LINEAGE_DEPTH; depth++) {
    const source = graph.getNode(current.componentId)
    if (!source) break
    if (source.type === 'TEXT' && source.textAutoResize === 'HEIGHT') return true
    current = source
  }
  return false
}

function canShapeGeneratedText(graph: SceneGraph, node: SceneNode): boolean {
  if (
    node.type !== 'TEXT' ||
    node.source.format === 'fig' ||
    !node.componentId ||
    !node.derivedLayout ||
    node.derivedLayout.width !== node.width ||
    node.derivedLayout.height !== node.height
  ) {
    return false
  }

  const sourceText = terminalTextSource(graph, node)
  if (sourceText?.source.format !== 'fig') return false
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') {
    return !hasFixedWidthTextAncestor(graph, node)
  }
  return (
    node.textAutoResize === 'HEIGHT' &&
    node.layoutAlignSelf === 'STRETCH' &&
    parentHugsWidth(graph, node) &&
    sourceText.text === node.text
  )
}

function stretchesCrossAxis(child: SceneNode, parent: SceneNode): boolean {
  return (
    child.layoutAlignSelf === 'STRETCH' ||
    (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  )
}

function participatesInIntrinsicSize(node: SceneNode): boolean {
  return node.visible && node.layoutPositioning !== 'ABSOLUTE'
}

function intrinsicSize(
  graph: SceneGraph,
  node: SceneNode,
  sizes: ReadonlyMap<string, Size>
): Size | null {
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return null
  const children = graph.getChildren(node.id).filter(participatesInIntrinsicSize)
  if (children.length === 0) return null

  const childSizes = children.map((child) => sizes.get(child.id) ?? child)
  const gap =
    node.primaryAxisAlign === 'SPACE_BETWEEN'
      ? 0
      : node.itemSpacing * Math.max(0, children.length - 1)
  if (node.layoutMode === 'HORIZONTAL') {
    return {
      width:
        node.paddingLeft +
        node.paddingRight +
        childSizes.reduce((sum, child) => sum + child.width, gap),
      height:
        node.paddingTop + node.paddingBottom + Math.max(...childSizes.map((child) => child.height))
    }
  }
  return {
    width:
      node.paddingLeft + node.paddingRight + Math.max(...childSizes.map((child) => child.width)),
    height:
      node.paddingTop +
      node.paddingBottom +
      childSizes.reduce((sum, child) => sum + child.height, gap)
  }
}

function intrinsicSizeWithEffectiveStretch(
  graph: SceneGraph,
  node: SceneNode,
  sizes: ReadonlyMap<string, Size>,
  affected: ReadonlySet<string>
): Size | null {
  const intrinsic = intrinsicSize(graph, node, sizes)
  if (!intrinsic || node.layoutMode !== 'VERTICAL' || axisSizing(node, 'width') !== 'HUG') {
    return intrinsic
  }
  const children = graph.getChildren(node.id).filter(participatesInIntrinsicSize)
  if (!children.some((child) => affected.has(child.id))) return intrinsic
  const widthCandidates = children.filter(
    (child) => affected.has(child.id) || !stretchesCrossAxis(child, node)
  )
  if (widthCandidates.length === 0) return intrinsic
  return {
    ...intrinsic,
    width:
      node.paddingLeft +
      node.paddingRight +
      Math.max(...widthCandidates.map((child) => (sizes.get(child.id) ?? child).width))
  }
}

function stretchChildrenToEffectiveWidth(
  graph: SceneGraph,
  node: SceneNode,
  oldIntrinsicWidth: number,
  nextWidth: number,
  currentSizes: Map<string, Size>,
  affected: Set<string>
): void {
  const oldContentWidth = oldIntrinsicWidth - node.paddingLeft - node.paddingRight
  const nextContentWidth = nextWidth - node.paddingLeft - node.paddingRight
  for (const child of graph.getChildren(node.id)) {
    if (
      !participatesInIntrinsicSize(child) ||
      !stretchesCrossAxis(child, node) ||
      Math.abs(child.width - oldContentWidth) >= 0.001
    ) {
      continue
    }
    const updates: Partial<SceneNode> = { width: nextContentWidth }
    if (child.derivedLayout) {
      updates.derivedLayout = { ...child.derivedLayout, width: nextContentWidth }
    }
    graph.updateNode(child.id, updates)
    currentSizes.set(child.id, { width: nextContentWidth, height: child.height })
    affected.add(child.id)
  }
}

function collectPostorder(graph: SceneGraph, rootId: string): SceneNode[] {
  const result: SceneNode[] = []
  const visit = (nodeId: string): void => {
    const node = graph.getNode(nodeId)
    if (!node) return
    for (const childId of node.childIds) visit(childId)
    result.push(node)
  }
  visit(rootId)
  return result
}

function updateGeneratedTextWidths(
  graph: SceneGraph,
  nodes: SceneNode[],
  currentSizes: Map<string, Size>,
  affected: Set<string>
): void {
  const measure = getTextMeasurer()
  if (!measure) return

  for (const node of nodes) {
    if (!canShapeGeneratedText(graph, node)) continue
    const measured = measure(node)
    if (!measured || measured.width <= 0) continue
    const widthChange = node.width - measured.width
    if (
      widthChange < MIN_EFFECTIVE_TEXT_WIDTH_CHANGE ||
      (node.textAutoResize === 'HEIGHT' && widthChange > MAX_STRETCHED_TEXT_WIDTH_CHANGE)
    ) {
      continue
    }

    graph.updateNode(node.id, {
      width: measured.width,
      derivedLayout: { ...node.derivedLayout, width: measured.width }
    })
    currentSizes.set(node.id, { width: measured.width, height: node.height })
    affected.add(node.id)
  }
}

function propagateIntrinsicSizes(
  graph: SceneGraph,
  nodes: SceneNode[],
  originalSizes: ReadonlyMap<string, Size>,
  currentSizes: Map<string, Size>,
  affected: Set<string>
): void {
  for (const node of nodes) {
    if (node.type === 'TEXT') continue
    const children = graph.getChildren(node.id)
    if (!children.some((child) => affected.has(child.id))) continue

    const oldIntrinsic = intrinsicSize(graph, node, originalSizes)
    const nextIntrinsic = intrinsicSizeWithEffectiveStretch(graph, node, currentSizes, affected)
    const oldSize = originalSizes.get(node.id)
    if (!oldIntrinsic || !nextIntrinsic || !oldSize) continue

    const updates: Partial<SceneNode> = {}
    let nextWidth = oldSize.width
    let nextHeight = oldSize.height
    if (
      canResizeIntrinsicAxis(node, 'width') &&
      Math.abs(oldSize.width - oldIntrinsic.width) < 0.001
    ) {
      nextWidth = nextIntrinsic.width
      updates.width = nextWidth
    }
    if (
      canResizeIntrinsicAxis(node, 'height') &&
      Math.abs(oldSize.height - oldIntrinsic.height) < 0.001
    ) {
      nextHeight = nextIntrinsic.height
      updates.height = nextHeight
    }
    if (Object.keys(updates).length === 0) continue

    if (node.derivedLayout) {
      const derivedLayout = { ...node.derivedLayout }
      if (updates.width !== undefined) derivedLayout.width = nextWidth
      if (updates.height !== undefined) derivedLayout.height = nextHeight
      updates.derivedLayout = derivedLayout
    }
    if (updates.width !== undefined) {
      stretchChildrenToEffectiveWidth(
        graph,
        node,
        oldIntrinsic.width,
        nextWidth,
        currentSizes,
        affected
      )
    }
    graph.updateNode(node.id, updates)
    currentSizes.set(node.id, { width: nextWidth, height: nextHeight })
    affected.add(node.id)
  }
}

export function applyEffectiveGeneratedTextLayout(graph: SceneGraph, rootId: string): boolean {
  const nodes = collectPostorder(graph, rootId)
  const originalSizes = new Map(
    nodes.map((node) => [node.id, { width: node.width, height: node.height }])
  )
  const currentSizes = new Map(originalSizes)
  const affected = new Set<string>()

  updateGeneratedTextWidths(graph, nodes, currentSizes, affected)
  if (affected.size === 0) return false
  propagateIntrinsicSizes(graph, nodes, originalSizes, currentSizes, affected)
  return true
}
