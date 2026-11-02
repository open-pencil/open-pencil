import { pick } from 'es-toolkit/object'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  fitEnclosingGroups,
  redoGroupFit,
  undoGroupFit
} from '@open-pencil/scene-graph/group-bounds'

import { groupFitOptions } from '#core/canvas/boolean'
import type { EditorContext } from '#core/editor/types'

/** The types Figma's layer type menu switches between. */
export type LayerType = 'FRAME' | 'GROUP' | 'SECTION'

/** What a frame has and a group does not, restored when the change to a group is undone. */
const FRAME_ONLY_FIELDS = [
  'type',
  'fills',
  'strokes',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'independentCorners',
  'layoutMode',
  'clipsContent',
  'layoutGrids',
  'fillStyleId',
  'strokeStyleId',
  'gridStyleId'
] as const

/** What a frame or group has and a section does not, restored when the change is undone. */
const NON_SECTION_FIELDS = [
  'type',
  'opacity',
  'effects',
  'effectStyleId',
  'clipsContent',
  'layoutMode',
  'strokeWeight',
  'strokes'
] as const

/**
 * The types a layer can switch to from Figma's layer type menu (Figma desktop 126): a section
 * sits on the page or in a section, a group needs layers, a section never becomes a group, and
 * one holding a section never becomes a frame.
 */
export function layerTypeOptions(graph: SceneGraph, node: SceneNode): Record<LayerType, boolean> {
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  const topLevel = parent?.type === 'CANVAS' || parent?.type === 'SECTION'
  // A frame cannot hold a section, so a section holding one stays a section.
  const holdsSection = node.childIds.some((id) => graph.getNode(id)?.type === 'SECTION')
  return {
    FRAME: !holdsSection,
    GROUP: node.type !== 'SECTION' && node.childIds.length > 0,
    SECTION: topLevel
  }
}

export function createLayerTypeActions(ctx: EditorContext) {
  function pushChange(
    label: string,
    nodeId: string,
    before: Partial<SceneNode>,
    after: Partial<SceneNode>
  ) {
    const apply = (changes: Partial<SceneNode>) => {
      ctx.graph.updateNode(nodeId, structuredClone(changes))
      ctx.runLayoutForNode(nodeId)
    }
    apply(after)
    ctx.undo.push({ label, forward: () => apply(after), inverse: () => apply(before) })
  }

  /**
   * Turns a group into a frame in place, as Figma's layer type menu does. The layer keeps its id,
   * children, bounds and look: a group has no fill, and the frame clips to the bounds its
   * children already fill. A section becomes a frame the same way, keeping its fill and strokes.
   */
  function convertToFrame(nodeId: string) {
    const node = ctx.graph.getNode(nodeId)
    if (node?.type !== 'GROUP' && node?.type !== 'SECTION') return
    if (!layerTypeOptions(ctx.graph, node).FRAME) return
    const before = { type: node.type, clipsContent: node.clipsContent }
    pushChange('Convert to frame', nodeId, before, { type: 'FRAME', clipsContent: true })
  }

  /**
   * Turns a frame into a group in place, as Figma's layer type menu does: the layer keeps its id,
   * children, effects and opacity, drops what a group cannot have (fill, stroke, corners, auto
   * layout, guides), and fits its children, so one the frame clipped now widens it.
   */
  function convertFrameToGroup(nodeId: string) {
    const frame = ctx.graph.getNode(nodeId)
    if (frame?.type !== 'FRAME' || frame.childIds.length === 0) return
    const before = structuredClone(pick(frame, FRAME_ONLY_FIELDS))
    const after: Partial<SceneNode> = {
      type: 'GROUP',
      fills: [],
      strokes: [],
      cornerRadius: 0,
      topLeftRadius: 0,
      topRightRadius: 0,
      bottomRightRadius: 0,
      bottomLeftRadius: 0,
      independentCorners: false,
      layoutMode: 'NONE',
      clipsContent: false,
      layoutGrids: [],
      fillStyleId: null,
      strokeStyleId: null,
      gridStyleId: null
    }
    ctx.graph.updateNode(nodeId, after)
    const fit = fitEnclosingGroups(
      ctx.graph,
      [nodeId],
      groupFitOptions(ctx.getRenderer(), ctx.graph)
    )
    ctx.runLayoutForNode(nodeId)
    ctx.undo.push({
      label: 'Convert to group',
      forward: () => {
        ctx.graph.updateNode(nodeId, after)
        if (fit) redoGroupFit(ctx.graph, fit)
        ctx.runLayoutForNode(nodeId)
      },
      inverse: () => {
        if (fit) undoGroupFit(ctx.graph, fit)
        ctx.graph.updateNode(nodeId, structuredClone(before))
        ctx.runLayoutForNode(nodeId)
      }
    })
  }

  /**
   * Turns a frame or group on the page or in a section into a section in place, as Figma's layer
   * type menu does: its layers stay where they are, auto layout included, and it keeps its fill,
   * strokes and corners, but not what a section lacks: opacity, effects, clipping, auto layout,
   * and a stroke weight of its own.
   */
  function convertToSection(nodeId: string) {
    const node = ctx.graph.getNode(nodeId)
    if (node?.type !== 'FRAME' && node?.type !== 'GROUP') return
    if (!layerTypeOptions(ctx.graph, node).SECTION) return
    const before = structuredClone(pick(node, NON_SECTION_FIELDS))
    pushChange('Convert to section', nodeId, before, {
      type: 'SECTION',
      opacity: 1,
      effects: [],
      effectStyleId: null,
      clipsContent: false,
      layoutMode: 'NONE',
      strokeWeight: 1,
      strokes: node.strokes.map((stroke) => ({ ...stroke, weight: 1 }))
    })
  }

  /** Switches a layer to another type in place, as Figma's layer type menu does. */
  function convertLayerType(nodeId: string, type: LayerType) {
    if (type === 'GROUP') convertFrameToGroup(nodeId)
    else if (type === 'SECTION') convertToSection(nodeId)
    else convertToFrame(nodeId)
  }

  return { convertLayerType }
}
