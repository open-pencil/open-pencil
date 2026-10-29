import * as v from 'valibot'

import { SceneGraph } from '@open-pencil/scene-graph'

import { pathNetwork } from './geometry'
import { removeUnusedIconComponents } from './icons'
import { createImageStore } from './images'
import { inAncestorThemes, populateInstances } from './instances'
import { spreadAround } from './layout'
import { createSceneNode, redrawIconAtLaidOutSize, type Build, type PenIconSource } from './nodes'
import { placeLayers } from './placement'
import { penFileSchema, type PenDocument, type PenNode } from './schema'
import { buildVarContext } from './variables'

/** Options for reading a document. */
export interface PenReadOptions {
  /**
   * Lays out the graph's auto layout and text, as `layoutAuthoredNodes` in Core does. Turned and
   * mirrored layers are placed after it, since where they land depends on their final size.
   */
  layout?(graph: SceneGraph): void
  /** The image files the document's paints name, by their URL in it; see `penAssets`. */
  images?: ReadonlyMap<string, Uint8Array>
  /** Where icon glyphs come from; icons are empty frames without it. */
  icons?: PenIconSource
}

function collectComponents(nodes: PenNode[], components: Map<string, PenNode>): void {
  for (const node of nodes) {
    if (node.reusable) components.set(node.id, node)
    if (node.children) collectComponents(node.children, components)
  }
}

/** Whether a group sits in an auto layout's flow, where fitting it changes the layout. */
function groupsInFlow(graph: SceneGraph, groupIds: Iterable<string>): boolean {
  for (const id of groupIds) {
    const group = graph.getNode(id)
    const parent = group?.parentId ? graph.getNode(group.parentId) : undefined
    if (parent && parent.layoutMode !== 'NONE') return true
  }
  return false
}

/**
 * Draws each path in its box once boxes have their final size, which fill and fit sizing only give
 * once laid out, and redraws each icon laying out sized.
 */
function drawAtFinalSize(build: Build, laidOut: boolean): void {
  for (const [id, pen] of build.effective) {
    const node = build.graph.getNode(id)
    if (!node) continue
    if (pen.type === 'path') {
      const network = pathNetwork(pen, node.width, node.height)
      if (network) node.vectorNetwork = network
    } else if (pen.type === 'icon' && laidOut) {
      // In the themes the icon was read in, which its colour and glyph may take variables from.
      inAncestorThemes(build, node, () => {
        const leave = pen.theme ? build.ctx.enterTheme(pen.theme) : undefined
        try {
          redrawIconAtLaidOutSize(node, pen, build)
        } finally {
          leave?.()
        }
      })
    }
  }
}

/** A `.pen` document's JSON, validated; throws for text that is not one. */
export function parsePenDocument(json: string): PenDocument {
  const parsed = v.safeParse(penFileSchema, json)
  if (!parsed.success) {
    throw new Error(`Not a .pen document: ${v.summarize(parsed.issues)}`)
  }
  return parsed.output
}

/** Builds the scene graph of a document `parsePenDocument` read. */
export function buildPenGraph(doc: PenDocument, options: PenReadOptions = {}): SceneGraph {
  const graph = new SceneGraph()

  for (const page of graph.getPages(true)) {
    graph.deleteNode(page.id)
  }

  const build: Build = {
    graph,
    ctx: buildVarContext(graph, doc),
    images: createImageStore(graph, options.images),
    icons: options.icons,
    components: new Map(),
    effective: new Map(),
    instances: new Map(),
    placements: new Map(),
    groupIds: new Set(),
    aroundIds: new Set(),
    iconComponents: new Map(),
    iconPageId: null,
    replaced: new Set()
  }
  collectComponents(doc.children, build.components)

  const page = graph.addPage(doc.children[0]?.name ?? 'Page 1')
  for (const child of doc.children) createSceneNode(child, page.id, build)
  populateInstances(build)

  options.layout?.(graph)
  drawAtFinalSize(build, options.layout !== undefined)
  const spread = options.layout ? spreadAround(graph, [...build.aroundIds]) : false
  placeLayers(graph, build.placements, [...build.groupIds])
  if (options.layout && (spread || groupsInFlow(graph, build.groupIds))) {
    options.layout(graph)
    drawAtFinalSize(build, true)
  }
  removeUnusedIconComponents(build)

  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}

export function parsePenFile(json: string, options: PenReadOptions = {}): SceneGraph {
  return buildPenGraph(parsePenDocument(json), options)
}

export async function readPenFile(file: File, options?: PenReadOptions): Promise<SceneGraph> {
  return parsePenFile(await file.text(), options)
}
