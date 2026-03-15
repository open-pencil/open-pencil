import { SceneGraph } from './scene-graph'
import { populateInstanceChildren } from './scene-graph-instances'
import { copyEffects, copyFills, copyStrokes } from './copy'
import { parseSVGPath } from './svg-path-parse'

import {
  buildVarContext,
  convertFill,
  convertStroke,
  convertEffects,
  applyCornerRadius,
  applyPadding,
  parseSize,
  mapLayoutMode,
  mapJustifyContent,
  mapAlignItems,
  mapTextAlign,
  mapTextAlignVertical,
  mapFontWeight,
  mapNodeType,
  isVarRef,
  bindIfVar
} from './pen-convert'

import type { LayoutMode, LayoutSizing, SceneNode, VectorNetwork } from './scene-graph'
import type { PenDocument, PenNode, VarContext } from './pen-convert'

function scaleVectorNetwork(vn: VectorNetwork, targetW: number, targetH: number): void {
  if (vn.vertices.length === 0) return
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const v of vn.vertices) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x)
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y)
  }
  const vnW = maxX - minX
  const vnH = maxY - minY
  if (vnW < 0.01 || vnH < 0.01) return
  const sx = targetW / vnW
  const sy = targetH / vnH
  if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return
  for (const v of vn.vertices) {
    v.x = (v.x - minX) * sx
    v.y = (v.y - minY) * sy
  }
  for (const s of vn.segments) {
    s.tangentStart = { x: s.tangentStart.x * sx, y: s.tangentStart.y * sy }
    s.tangentEnd = { x: s.tangentEnd.x * sx, y: s.tangentEnd.y * sy }
  }
}

function resolveFontFamily(raw: string | undefined, ctx: VarContext): string {
  if (!raw) return 'Inter'
  if (isVarRef(raw)) return ctx.resolveString(raw)
  return raw
}

function buildBaseOverrides(pen: PenNode): Partial<SceneNode> {
  return {
    id: pen.id,
    name: pen.name ?? (pen.type === 'icon_font' ? (pen.iconFontName ?? 'Icon') : pen.type),
    x: pen.x ?? 0,
    y: pen.y ?? 0,
    visible: pen.enabled !== false,
    opacity: pen.opacity ?? 1,
    rotation: pen.rotation ?? 0,
    flipX: pen.flipX ?? false,
    flipY: pen.flipY ?? false,
    clipsContent: pen.clip ?? false,
    boundVariables: {}
  }
}

function applyAutoLayout(
  overrides: Partial<SceneNode>,
  layoutMode: LayoutMode,
  pen: PenNode,
  widthSizing: LayoutSizing,
  heightSizing: LayoutSizing
): void {
  overrides.layoutMode = layoutMode
  overrides.primaryAxisAlign = mapJustifyContent(pen.justifyContent)
  overrides.counterAxisAlign = mapAlignItems(pen.alignItems)
  overrides.itemSpacing = pen.gap ?? 0

  if (layoutMode === 'VERTICAL') {
    overrides.primaryAxisSizing = heightSizing
    overrides.counterAxisSizing = widthSizing
  } else {
    overrides.primaryAxisSizing = widthSizing
    overrides.counterAxisSizing = heightSizing
  }
}

function applyTextProps(node: SceneNode, pen: PenNode, ctx: VarContext): void {
  node.text = pen.type === 'icon_font' ? (pen.iconFontName ?? '') : (pen.content ?? '')
  node.fontFamily = pen.type === 'icon_font'
    ? (pen.iconFontFamily ?? 'Material Symbols Sharp')
    : resolveFontFamily(pen.fontFamily, ctx)
  node.fontSize = pen.fontSize ?? 14
  node.fontWeight = mapFontWeight(pen.fontWeight ?? (pen.type === 'icon_font' ? pen.weight : undefined))
  node.textAlignHorizontal = mapTextAlign(pen.textAlign)
  node.textAlignVertical = mapTextAlignVertical(pen.textAlignVertical)
  if (pen.lineHeight !== undefined) {
    node.lineHeight = pen.lineHeight < 5 ? pen.lineHeight * node.fontSize : pen.lineHeight
  }
  if (pen.letterSpacing !== undefined) node.letterSpacing = pen.letterSpacing

  if (pen.textGrowth === 'fixed-width') node.textAutoResize = 'HEIGHT'
  else node.textAutoResize = 'WIDTH_AND_HEIGHT'

  if (pen.fontFamily && isVarRef(pen.fontFamily)) {
    bindIfVar(node, 'fontFamily', pen.fontFamily, ctx)
  }
}

function resolveSizing(pen: PenNode) {
  const isTextLike = pen.type === 'text' || pen.type === 'icon_font'
  const defaultSize = isTextLike ? 20 : 100
  const defaultW = isTextLike && pen.width === undefined ? 10000 : defaultSize
  const w = parseSize(pen.width, defaultW)
  const h = parseSize(pen.height, defaultSize)
  const layout = mapLayoutMode(pen)

  if (pen.width === undefined && layout !== 'NONE') w.sizing = 'HUG'
  if (pen.height === undefined && layout !== 'NONE') h.sizing = 'HUG'

  return { w, h, layout, isTextLike }
}

function inheritLayoutFromComp(node: SceneNode, pen: PenNode, comp: SceneNode): void {
  const wasRow = node.layoutMode === 'HORIZONTAL'
  node.layoutMode = comp.layoutMode
  node.primaryAxisAlign = comp.primaryAxisAlign
  node.counterAxisAlign = comp.counterAxisAlign
  const isRow = node.layoutMode === 'HORIZONTAL'
  if (wasRow !== isRow) {
    const oldP = node.primaryAxisSizing
    const oldC = node.counterAxisSizing
    node.primaryAxisSizing = oldC
    node.counterAxisSizing = oldP
  }
  const widthAxis = isRow ? 'primaryAxisSizing' : 'counterAxisSizing'
  const heightAxis = isRow ? 'counterAxisSizing' : 'primaryAxisSizing'
  if (pen.width === undefined) node[widthAxis] = comp[widthAxis]
  if (pen.height === undefined) node[heightAxis] = comp[heightAxis]
  if (pen.gap === undefined) node.itemSpacing = comp.itemSpacing
  if (pen.padding === undefined) {
    node.paddingTop = comp.paddingTop
    node.paddingRight = comp.paddingRight
    node.paddingBottom = comp.paddingBottom
    node.paddingLeft = comp.paddingLeft
  }
  if (pen.clip === undefined) node.clipsContent = comp.clipsContent
}

function applyRefVisuals(
  node: SceneNode, pen: PenNode, compPen: PenNode | undefined, ctx: VarContext
): void {
  if (!compPen) return
  if (pen.fill === undefined && compPen.fill !== undefined) node.fills = convertFill(compPen.fill, ctx, node)
  if (pen.stroke === undefined && compPen.stroke) node.strokes = convertStroke(compPen.stroke, ctx, node)
  if (pen.effect === undefined && compPen.effect) node.effects = convertEffects(compPen.effect)
  if (pen.cornerRadius === undefined) applyCornerRadius(node, compPen.cornerRadius, ctx)
}

function applyRefProps(
  node: SceneNode, pen: PenNode, graph: SceneGraph,
  componentIds: Map<string, string>, penSources: Map<string, PenNode>, ctx: VarContext
): void {
  if (!pen.ref) return
  node.componentId = componentIds.get(pen.ref) ?? pen.ref
  const comp = graph.getNode(node.componentId)
  if (!comp) return
  if (pen.width === undefined) node.width = comp.width
  if (pen.height === undefined) node.height = comp.height
  if (pen.layout === undefined) inheritLayoutFromComp(node, pen, comp)
  applyRefVisuals(node, pen, penSources.get(pen.ref), ctx)
}

function applyAllRefProps(
  penNodes: PenNode[], graph: SceneGraph,
  componentIds: Map<string, string>, penSources: Map<string, PenNode>, ctx: VarContext
): void {
  for (const pen of penNodes) {
    if (pen.type === 'ref') {
      const node = graph.getNode(pen.id)
      if (node) applyRefProps(node, pen, graph, componentIds, penSources, ctx)
    }
    if (pen.children) applyAllRefProps(pen.children, graph, componentIds, penSources, ctx)
  }
}

function applyTheme(theme: Record<string, string>, ctx: VarContext): void {
  const themeName = Object.values(theme)[0]
  if (themeName) ctx.setActiveTheme(themeName)
}

// eslint-disable-next-line complexity -- .pen node mapping requires many property checks
function createSceneNode(
  pen: PenNode,
  parentId: string,
  graph: SceneGraph,
  ctx: VarContext,
  componentIds: Map<string, string>,
  penSources: Map<string, PenNode>
): string | null {
  if (pen.type === 'prompt') return null
  if (pen.theme) applyTheme(pen.theme, ctx)

  const { w, h, layout, isTextLike } = resolveSizing(pen)

  const overrides = buildBaseOverrides(pen)
  overrides.width = w.value
  overrides.height = h.value
  if (w.min) overrides.minWidth = w.min
  if (h.min) overrides.minHeight = h.min

  const parentLayout = graph.getNode(parentId)?.layoutMode ?? 'NONE'
  if (layout !== 'NONE') {
    const wS = parentLayout === 'NONE' && w.sizing === 'FILL' ? 'FIXED' as LayoutSizing : w.sizing
    const hS = parentLayout === 'NONE' && h.sizing === 'FILL' ? 'FIXED' as LayoutSizing : h.sizing
    applyAutoLayout(overrides, layout, pen, wS, hS)
  }

  const node = graph.createNode(mapNodeType(pen), parentId, overrides)

  if (pen.fill !== undefined) node.fills = convertFill(pen.fill, ctx, node)
  if (pen.stroke) node.strokes = convertStroke(pen.stroke, ctx, node)
  node.effects = convertEffects(pen.effect)
  applyCornerRadius(node, pen.cornerRadius, ctx)
  applyPadding(node, pen.padding)
  if (isTextLike) {
    applyTextProps(node, pen, ctx)
    if (parentLayout === 'NONE' && pen.width === undefined && !pen.textGrowth) {
      node.textAutoResize = 'NONE'
      node.width = node.text.length * node.fontSize * 0.65
      node.height = node.fontSize * (node.lineHeight ? node.lineHeight / node.fontSize : 1.2)
    }
  }
  if (pen.type === 'path' && pen.geometry) {
    node.vectorNetwork = parseSVGPath(pen.geometry)
    scaleVectorNetwork(node.vectorNetwork, node.width, node.height)
  }

  if (parentLayout !== 'NONE') {
    const pv = parentLayout === 'VERTICAL'
    if (w.sizing === 'FILL') { if (pv) node.layoutAlignSelf = 'STRETCH'; else node.layoutGrow = 1 }
    if (h.sizing === 'FILL') { if (pv) node.layoutGrow = 1; else node.layoutAlignSelf = 'STRETCH' }
  }
  if (pen.reusable) { componentIds.set(pen.id, node.id); penSources.set(pen.id, pen) }

  if (pen.children) {
    for (const child of pen.children) {
      createSceneNode(child, node.id, graph, ctx, componentIds, penSources)
    }
  }

  return node.id
}

function findCloneByComponentId(graph: SceneGraph, parentId: string, origId: string): SceneNode | undefined {
  const parent = graph.getNode(parentId)
  if (!parent) return undefined
  for (const childId of parent.childIds) {
    const child = graph.getNode(childId)
    if (!child) continue
    if (child.componentId === origId) return child
    const deep = findCloneByComponentId(graph, childId, origId)
    if (deep) return deep
  }
  return undefined
}

function findCloneByNameFallback(graph: SceneGraph, parentId: string, origId: string): SceneNode | undefined {
  const orig = graph.getNode(origId)
  if (!orig) return undefined
  const matches: SceneNode[] = []
  collectByNameType(graph, parentId, orig.name, orig.type, matches, 0)
  return matches.length === 1 ? matches[0] : undefined
}

function collectByNameType(
  graph: SceneGraph, parentId: string, name: string, type: string, out: SceneNode[], depth: number
): void {
  if (depth > 2) return
  const parent = graph.getNode(parentId)
  if (!parent) return
  for (const childId of parent.childIds) {
    const child = graph.getNode(childId)
    if (!child) continue
    if (child.name === name && child.type === type) out.push(child)
    collectByNameType(graph, childId, name, type, out, depth + 1)
  }
}

function applyOverrideProps(
  target: SceneNode,
  overrideData: Partial<PenNode>,
  ctx: VarContext
): void {
  if (overrideData.fill !== undefined) target.fills = convertFill(overrideData.fill, ctx, target)
  if (overrideData.content !== undefined) target.text = overrideData.content
  if (overrideData.x !== undefined) target.x = overrideData.x
  if (overrideData.y !== undefined) target.y = overrideData.y
  if (overrideData.enabled !== undefined) target.visible = overrideData.enabled
  if (overrideData.width !== undefined) target.width = parseSize(overrideData.width, target.width).value
  if (overrideData.height !== undefined) target.height = parseSize(overrideData.height, target.height).value
  if (overrideData.rotation !== undefined) target.rotation = overrideData.rotation
  if (overrideData.name !== undefined) target.name = overrideData.name
}

function populateInstances(graph: SceneGraph): void {
  for (const node of graph.getAllNodes()) {
    if (node.type === 'INSTANCE' && node.componentId && node.childIds.length === 0) {
      const component = graph.getNode(node.componentId)
      if (component) {
        populateInstanceChildren(graph, node.id, node.componentId)
      }
    }
  }
}

function applyDescendantOverrides(
  graph: SceneGraph,
  pen: PenNode,
  ctx: VarContext,
  componentIds: Map<string, string>,
  penSources: Map<string, PenNode>
): void {
  if (pen.type !== 'ref' || !pen.descendants) return

  const instanceNode = graph.getNode(pen.id)
  if (!instanceNode) return

  for (const [origId, overrideData] of Object.entries(pen.descendants)) {
    const clone = findCloneByComponentId(graph, instanceNode.id, origId)
      ?? findCloneByNameFallback(graph, instanceNode.id, origId)
    if (clone) {
      if (overrideData.children) {
        const toDelete = clone.childIds.slice()
        for (const childId of toDelete) graph.deleteNode(childId)
        for (const child of overrideData.children) {
          createSceneNode(child, clone.id, graph, ctx, componentIds, penSources)
        }
      }
      applyOverrideProps(clone, overrideData, ctx)
      continue
    }

    if (overrideData.type && overrideData.id) {
      createSceneNode(overrideData as PenNode, instanceNode.id, graph, ctx, componentIds, penSources)
    }
  }
}

function walkAndApplyOverrides(
  nodes: PenNode[],
  graph: SceneGraph,
  ctx: VarContext,
  componentIds: Map<string, string>,
  penSources: Map<string, PenNode>
): void {
  for (const pen of nodes) {
    applyDescendantOverrides(graph, pen, ctx, componentIds, penSources)
    if (pen.children) walkAndApplyOverrides(pen.children, graph, ctx, componentIds, penSources)
  }
}

function collectComponentIds(nodes: PenNode[], map: Map<string, string>): void {
  for (const node of nodes) {
    if (node.reusable) map.set(node.id, node.id)
    if (node.children) collectComponentIds(node.children, map)
  }
}

export function parsePenFile(json: string): SceneGraph {
  const doc: PenDocument = JSON.parse(json)
  const graph = new SceneGraph()

  for (const page of graph.getPages(true)) {
    graph.deleteNode(page.id)
  }

  const ctx = buildVarContext(graph, doc.variables ?? {}, doc.themes ?? {})
  const componentIds = new Map<string, string>()
  const penSources = new Map<string, PenNode>()

  collectComponentIds(doc.children, componentIds)

  const page = graph.addPage(doc.children[0]?.name ?? 'Page 1')

  for (const child of doc.children) {
    createSceneNode(child, page.id, graph, ctx, componentIds, penSources)
  }
  applyAllRefProps(doc.children, graph, componentIds, penSources, ctx)

  populateInstances(graph)
  walkAndApplyOverrides(doc.children, graph, ctx, componentIds, penSources)
  populateInstances(graph)
  resolveThemeVariables(doc.children, graph, ctx)
  fixInstanceWidths(graph)
  fixTextWidths(graph)

  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}

function resolveThemeVariables(penNodes: PenNode[], graph: SceneGraph, ctx: VarContext): void {
  for (const pen of penNodes) {
    if (pen.theme) applyTheme(pen.theme, ctx)
    const node = graph.getNode(pen.id)
    if (node) resolveNodeVars(node, graph, ctx)
    if (pen.children) resolveThemeVariables(pen.children, graph, ctx)
  }
}

function resolveNodeVars(node: SceneNode, graph: SceneGraph, ctx: VarContext): void {
  const bv = node.boundVariables
  for (const [key, varId] of Object.entries(bv)) {
    const variable = graph.variables.get(varId)
    if (!variable) continue
    const modeVal = variable.valuesByMode[ctx.activeModeId]
      ?? Object.values(variable.valuesByMode)[0]
    if (key.startsWith('fills[') && typeof modeVal === 'object' && 'r' in modeVal) {
      const idx = parseInt(key.match(/\d+/)?.[0] ?? '0')
      if (node.fills[idx]) node.fills[idx].color = modeVal
    } else if (key.startsWith('strokes[') && typeof modeVal === 'object' && 'r' in modeVal) {
      const idx = parseInt(key.match(/\d+/)?.[0] ?? '0')
      if (node.strokes[idx]) node.strokes[idx].color = modeVal
    }
  }
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (child) resolveNodeVars(child, graph, ctx)
  }
}

function fixInstanceWidths(graph: SceneGraph): void {
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const comp = graph.getNode(node.componentId)
    if (!comp) continue
    if (node.width <= 100 && comp.width > 100) node.width = comp.width
    if (node.height <= 100 && comp.height > 100) node.height = comp.height
    if (comp.layoutGrow > 0) node.layoutGrow = comp.layoutGrow
    if (comp.layoutAlignSelf !== 'AUTO') node.layoutAlignSelf = comp.layoutAlignSelf
  }
}

function fixTextWidths(graph: SceneGraph): void {
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'TEXT' || !node.text || node.text.length <= 1) continue
    if (node.width >= node.fontSize * 2) continue
    node.width = node.text.length * node.fontSize * 0.65
  }
}

export async function readPenFile(file: File): Promise<SceneGraph> {
  const text = await file.text()
  return parsePenFile(text)
}
