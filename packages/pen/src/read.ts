import { computeImageHash, SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { copyEffects, copyFills, copyStrokes } from '@open-pencil/scene-graph/copy'
import { populateInstanceChildren } from '@open-pencil/scene-graph/instances'

import {
  applyCornerRadius,
  convertEffects,
  convertFill,
  convertStroke,
  normalizePenStroke,
  parseSize,
  type PenDocument,
  type PenImageResolver,
  type PenNode
} from './convert'
import { createSceneNode } from './nodes'
import { applyTheme, buildVarContext, type VarContext } from './variables'

function inheritLayoutFromComp(node: SceneNode, pen: PenNode, comp: SceneNode): void {
  const wasRow = node.layoutMode === 'HORIZONTAL'
  node.layoutMode = comp.layoutMode
  node.primaryAxisAlign = comp.primaryAxisAlign
  node.counterAxisAlign = comp.counterAxisAlign
  const isRow = node.layoutMode === 'HORIZONTAL'
  if (wasRow !== isRow) {
    const oldP = node.primaryAxisSizing
    node.primaryAxisSizing = node.counterAxisSizing
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
  node: SceneNode,
  pen: PenNode,
  compPen: PenNode | undefined,
  ctx: VarContext,
  resolveImage?: PenImageResolver
): void {
  if (!compPen) return
  if (pen.fill === undefined && compPen.fill !== undefined)
    node.fills = convertFill(compPen.fill, ctx, node, resolveImage)
  if (pen.stroke === undefined) {
    const inherited = normalizePenStroke(compPen)
    if (inherited) node.strokes = convertStroke(inherited, ctx, node)
  }
  if (pen.effect === undefined && compPen.effect) node.effects = convertEffects(compPen.effect)
  if (pen.cornerRadius === undefined) applyCornerRadius(node, compPen.cornerRadius, ctx)
}

function applyRefProps(
  node: SceneNode,
  pen: PenNode,
  graph: SceneGraph,
  componentIds: Map<string, string>,
  penSources: Map<string, PenNode>,
  ctx: VarContext,
  resolveImage?: PenImageResolver
): void {
  if (!pen.ref) return
  const componentId = componentIds.get(pen.ref) ?? pen.ref
  node.componentId = componentId
  const comp = graph.getNode(componentId)
  if (!comp) return
  if (pen.width === undefined) node.width = comp.width
  if (pen.height === undefined) node.height = comp.height
  if (pen.layout === undefined) inheritLayoutFromComp(node, pen, comp)
  applyRefVisuals(node, pen, penSources.get(pen.ref), ctx, resolveImage)
}

function applyAllRefProps(
  pen: PenNode,
  graph: SceneGraph,
  componentIds: Map<string, string>,
  penSources: Map<string, PenNode>,
  ctx: VarContext,
  resolveImage?: PenImageResolver
): void {
  if (pen.type === 'ref') {
    const node = graph.getNode(pen.id)
    if (node) applyRefProps(node, pen, graph, componentIds, penSources, ctx, resolveImage)
  }
  pen.children?.forEach((child) => {
    applyAllRefProps(child, graph, componentIds, penSources, ctx, resolveImage)
  })
}

function collectByNameType(
  graph: SceneGraph,
  parentId: string,
  name: string,
  type: string,
  out: SceneNode[],
  depth: number
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

function findCloneByComponentId(
  graph: SceneGraph,
  parentId: string,
  origId: string
): SceneNode | undefined {
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

function findCloneByNameFallback(
  graph: SceneGraph,
  parentId: string,
  origId: string
): SceneNode | undefined {
  const orig = graph.getNode(origId)
  if (!orig) return undefined
  const matches: SceneNode[] = []
  collectByNameType(graph, parentId, orig.name, orig.type, matches, 0)
  return matches.length === 1 ? matches[0] : undefined
}

/**
 * Resolves one `descendants` key against an instance. Pencil keys a direct descendant by its
 * plain node id, and one nested deeper by the slash-separated path that reaches it, such as
 * `parent/child`. Every segment resolves one level below the previous match, so a plain id is
 * the single-segment case.
 */
function findDescendantClone(
  graph: SceneGraph,
  instanceId: string,
  key: string
): SceneNode | undefined {
  let scopeId = instanceId
  let found: SceneNode | undefined
  for (const segment of key.split('/')) {
    found =
      findCloneByComponentId(graph, scopeId, segment) ??
      findCloneByNameFallback(graph, scopeId, segment)
    if (!found) return undefined
    scopeId = found.id
  }
  return found
}

/**
 * Drops the fill bindings a replaced paint invalidates. Without this the theme pass, which runs
 * after the overrides, would paint the component's variable back over the override.
 */
function clearFillBindings(node: SceneNode): void {
  const kept = Object.entries(node.boundVariables).filter(([key]) => !key.startsWith('fills['))
  node.boundVariables = Object.fromEntries(kept)
}

function applyOverrideProps(
  target: SceneNode,
  overrideData: Partial<PenNode>,
  ctx: VarContext,
  resolveImage?: PenImageResolver
): void {
  if (overrideData.fill !== undefined) {
    clearFillBindings(target)
    target.fills = convertFill(overrideData.fill, ctx, target, resolveImage)
  }
  if (overrideData.content !== undefined) target.text = overrideData.content
  if (overrideData.x !== undefined) target.x = overrideData.x
  if (overrideData.y !== undefined) target.y = overrideData.y
  if (overrideData.enabled !== undefined) target.visible = overrideData.enabled
  if (overrideData.width !== undefined)
    target.width = parseSize(overrideData.width, target.width, ctx).value
  if (overrideData.height !== undefined)
    target.height = parseSize(overrideData.height, target.height, ctx).value
  if (overrideData.rotation !== undefined) target.rotation = overrideData.rotation
  if (overrideData.name !== undefined) target.name = overrideData.name
}

function populateInstances(graph: SceneGraph): void {
  for (const node of graph.getAllNodes()) {
    if (node.type === 'INSTANCE' && node.componentId && node.childIds.length === 0) {
      const component = graph.getNode(node.componentId)
      if (component) populateInstanceChildren(graph, node.id, node.componentId)
    }
  }
}

function applyDescendantOverrides(
  graph: SceneGraph,
  pen: PenNode,
  ctx: VarContext,
  componentIds: Map<string, string>,
  penSources: Map<string, PenNode>,
  resolveImage?: PenImageResolver
): void {
  if (pen.type !== 'ref' || !pen.descendants) return
  const instanceNode = graph.getNode(pen.id)
  if (!instanceNode) return

  for (const [origId, overrideData] of Object.entries(pen.descendants)) {
    const clone = findDescendantClone(graph, instanceNode.id, origId)

    if (clone) {
      if (overrideData.children) {
        const toDelete = clone.childIds.slice()
        for (const childId of toDelete) graph.deleteNode(childId)
        overrideData.children.forEach((child) => {
          createSceneNode(child, clone.id, graph, ctx, componentIds, penSources, resolveImage)
        })
      }
      applyOverrideProps(clone, overrideData, ctx, resolveImage)
      continue
    }

    // An override that names no descendant and declares no node of its own has nothing to apply to.
    if (overrideData.type && overrideData.id) {
      createSceneNode(
        overrideData as PenNode,
        instanceNode.id,
        graph,
        ctx,
        componentIds,
        penSources,
        resolveImage
      )
    }
  }
}

function walkAndApplyOverrides(
  pen: PenNode,
  graph: SceneGraph,
  ctx: VarContext,
  componentIds: Map<string, string>,
  penSources: Map<string, PenNode>,
  resolveImage?: PenImageResolver
): void {
  applyDescendantOverrides(graph, pen, ctx, componentIds, penSources, resolveImage)
  pen.children?.forEach((child) => {
    walkAndApplyOverrides(child, graph, ctx, componentIds, penSources, resolveImage)
  })
}

function collectComponentIds(nodes: PenNode[], map: Map<string, string>): void {
  for (const node of nodes) {
    if (node.reusable) map.set(node.id, node.id)
    if (node.children) collectComponentIds(node.children, map)
  }
}

function resolveNodeVars(node: SceneNode, graph: SceneGraph, ctx: VarContext): void {
  for (const [key, varId] of Object.entries(node.boundVariables)) {
    const variable = graph.variables.get(varId)
    if (!variable) continue
    const modeVal =
      variable.valuesByMode[ctx.activeModeId] ?? Object.values(variable.valuesByMode)[0]
    if (key.startsWith('fills[') && typeof modeVal === 'object' && 'r' in modeVal) {
      const idx = Number.parseInt(key.match(/\d+/)?.[0] ?? '0', 10)
      if (node.fills[idx]) node.fills[idx].color = modeVal
    } else if (key.startsWith('strokes[') && typeof modeVal === 'object' && 'r' in modeVal) {
      const idx = Number.parseInt(key.match(/\d+/)?.[0] ?? '0', 10)
      if (node.strokes[idx]) node.strokes[idx].color = modeVal
    }
  }
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (child) resolveNodeVars(child, graph, ctx)
  }
}

function resolveThemeVariables(pen: PenNode, graph: SceneGraph, ctx: VarContext): void {
  if (pen.theme) applyTheme(pen.theme, ctx)
  const node = graph.getNode(pen.id)
  if (node) resolveNodeVars(node, graph, ctx)
  pen.children?.forEach((child) => {
    resolveThemeVariables(child, graph, ctx)
  })
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
    node.fills = copyFills(node.fills)
    node.strokes = copyStrokes(node.strokes)
    node.effects = copyEffects(node.effects)
  }
}

export interface PenImportOptions {
  /**
   * Reads the bytes an image fill points at. A `.pen` document names its assets relative to
   * itself, and the importer only receives its text, so the caller that knows where the file
   * lives supplies them. Without it a fill keeps its scale mode but no pixels.
   */
  resolveAsset?: (url: string) => Uint8Array | undefined
}

/**
 * Names an image asset's bytes by their content, once per url, and keeps them in the graph. A
 * document can point many fills at one asset, so each one is read once.
 */ function imageResolver(
  graph: SceneGraph,
  resolveAsset?: (url: string) => Uint8Array | undefined
): (url: string) => string | undefined {
  const resolved = new Map<string, string | undefined>()
  return (url) => {
    if (resolved.has(url)) return resolved.get(url)
    const data = resolveAsset?.(url)
    const hash = data ? computeImageHash(data) : undefined
    if (data && hash) graph.images.set(hash, data)
    resolved.set(url, hash)
    return hash
  }
}

/** Parses a `.pen` document into a graph. */
export function parsePenFile(json: string, options: PenImportOptions = {}): SceneGraph {
  const doc: PenDocument = JSON.parse(json)
  const graph = new SceneGraph()

  for (const page of graph.getPages(true)) {
    graph.deleteNode(page.id)
  }

  const resolveImage = imageResolver(graph, options.resolveAsset)
  const ctx = buildVarContext(graph, doc.variables ?? {}, doc.themes ?? {})
  const componentIds = new Map<string, string>()
  const penSources = new Map<string, PenNode>()

  collectComponentIds(doc.children, componentIds)

  const page = graph.addPage(doc.children[0]?.name ?? 'Page 1')
  doc.children.forEach((child) => {
    createSceneNode(child, page.id, graph, ctx, componentIds, penSources, resolveImage)
  })

  doc.children.forEach((child) => {
    applyAllRefProps(child, graph, componentIds, penSources, ctx, resolveImage)
  })
  populateInstances(graph)
  doc.children.forEach((child) => {
    walkAndApplyOverrides(child, graph, ctx, componentIds, penSources, resolveImage)
  })
  populateInstances(graph)
  doc.children.forEach((child) => {
    resolveThemeVariables(child, graph, ctx)
  })
  fixInstanceWidths(graph)

  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}

/**
 * Whether a `.pen` asset reference names a file in the document's own folder. A document names its
 * assets relative to itself, so an absolute path, a scheme or a `..` segment points somewhere else
 * on the machine and is not an asset.
 */
export function isDocumentAssetName(url: string): boolean {
  if (url === '' || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return false
  if (url.startsWith('/') || url.startsWith('\\')) return false
  return !url.split(/[\\/]/).includes('..')
}

/**
 * The asset urls a `.pen` document references, in document order and without repeats. A caller
 * that can only read them asynchronously needs the list before parsing, because
 * {@link PenImportOptions.resolveAsset} answers synchronously.
 */
export function collectPenAssetUrls(json: string): string[] {
  const doc: PenDocument = JSON.parse(json)
  const urls = new Set<string>()
  const collectFills = (fill: PenNode['fill']) => {
    if (fill === undefined) return
    for (const item of Array.isArray(fill) ? fill : [fill]) {
      if (typeof item !== 'string' && item.type === 'image' && item.url !== undefined) {
        urls.add(item.url)
      }
    }
  }
  const collect = (pen: PenNode) => {
    collectFills(pen.fill)
    // An override can replace a paint with an image of its own, and can add nodes to the instance,
    // so the assets those point at belong to the document as much as the ones it declares directly.
    for (const override of Object.values(pen.descendants ?? {})) {
      collectFills(override.fill)
      for (const child of override.children ?? []) collect(child)
    }
    for (const child of pen.children ?? []) collect(child)
  }
  for (const child of doc.children) collect(child)
  return [...urls]
}

export async function readPenFile(file: File, options?: PenImportOptions): Promise<SceneGraph> {
  return parsePenFile(await file.text(), options)
}
