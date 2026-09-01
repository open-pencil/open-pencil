export { constrainToAspectRatio } from '#vue/shared/input/resize/rect'
export { tryStartResize } from '#vue/shared/input/resize/start'
import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { calibratePathTextLayout, reflowPathTextGlyphs } from '@open-pencil/core/text'
import { cloneVectorNetwork } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import { copyDerivedGlyphs, copyGeometryPaths, copyStrokes } from '@open-pencil/scene-graph/copy'
import {
  computeConstrainedResizeChanges,
  scaledGeometryChanges,
  type ResizeSnapshot
} from '@open-pencil/scene-graph/resize'

import { calculateResizeRect } from '#vue/shared/input/resize/rect'
import { applyResizeSnap } from '#vue/shared/input/resize/snap'
import { optionalEditorState } from '#vue/shared/input/snap'
import type { DragResize } from '#vue/shared/input/types'

/**
 * Resize path-text glyphs without baking anisotropic scale into fontSize.
 * commandsBlob stays in font units; paint multiplies by fontSize then scaleX/Y.
 * Accumulating scaleX/Y (not fontSize *= avg) keeps non-uniform stretch correct
 * under rotation — see drawDerivedText transform order.
 */
/**
 * Figma resize semantics for imported text-on-path: constant font size,
 * glyphs re-placed along the scaled path (see core/text/path). Used
 * instead of geometric glyph/silhouette scaling whenever the node still has
 * its layout path. Baked node-level silhouettes cannot follow re-placed
 * glyphs, so strokeGeometry is cleared — the renderer rebuilds silhouettes
 * per glyph — and stroke weight stays constant like the font size.
 */
function reflowedPathTextChanges(
  orig: Pick<ResizeSnapshot, 'textPathData' | 'textPathBox' | 'derivedTextGlyphs' | 'strokes'>,
  sx: number,
  sy: number
): Partial<SceneNode> | null {
  if (!orig.textPathData || !orig.textPathBox || !orig.derivedTextGlyphs?.length) return null
  const data = orig.textPathData
  const layout = calibratePathTextLayout(orig.derivedTextGlyphs, data, orig.textPathBox)
  if (!layout) return null
  const box = {
    x: orig.textPathBox.x * sx,
    y: orig.textPathBox.y * sy,
    width: orig.textPathBox.width * sx,
    height: orig.textPathBox.height * sy
  }
  const glyphs = reflowPathTextGlyphs(orig.derivedTextGlyphs, data, layout, box)
  if (!glyphs) return null
  return {
    derivedTextGlyphs: glyphs,
    textPathBox: box,
    strokeGeometry: [],
    strokes: copyStrokes(orig.strokes)
  }
}

function resizeChanges(
  d: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  editor: Editor,
  disableSnapping: boolean
) {
  const { origRect } = d
  const calculatedRect = calculateResizeRect(
    d.handle,
    origRect,
    cx - d.startX,
    cy - d.startY,
    constrain
  )
  const newRect = constrain
    ? calculatedRect
    : applyResizeSnap(d, calculatedRect, editor, disableSnapping)

  const changes: Partial<SceneNode> = {
    ...newRect,
    ...scaledGeometryChanges(
      {
        vectorNetwork: d.origVectorNetwork,
        fillGeometry: d.origFillGeometry,
        strokeGeometry: d.origStrokeGeometry,
        derivedTextGlyphs: d.origDerivedTextGlyphs,
        strokes: d.origStrokes,
        textPathData: d.origTextPathData,
        textPathBox: d.origTextPathBox
      },
      origRect.width,
      origRect.height,
      newRect.width,
      newRect.height
    )
  }
  return { changes, newRect }
}

/**
 * Re-apply the root resize to descendants through the constraint engine, then
 * layer path-text reflow on top: constrained children get their own before/after
 * box, and path text must re-place glyphs along its path rather than scale as a
 * blob (see reflowedPathTextChanges).
 */
function applyConstrainedChildren(
  d: DragResize,
  newRect: Pick<SceneNode, 'width' | 'height'>,
  editor: Editor
) {
  if (!d.origChildren || d.origRect.width <= 0 || d.origRect.height <= 0) return
  const changes = computeConstrainedResizeChanges(
    editor.graph,
    d.nodeId,
    d.origRect,
    newRect,
    d.origChildren
  )
  for (const [childId, childChanges] of changes) {
    const orig = d.origChildren.get(childId)
    if (orig && orig.width > 0 && orig.height > 0) {
      const width = childChanges.width ?? orig.width
      const height = childChanges.height ?? orig.height
      const reflow = reflowedPathTextChanges(orig, width / orig.width, height / orig.height)
      if (reflow) Object.assign(childChanges, reflow)
    }
    editor.graph.updateNodePreview(childId, childChanges)
    editor.renderer?.invalidateVectorPath(childId)
  }
}

export function applyResize(
  dragState: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  editor: Editor,
  disableSnapping = false
) {
  // Drag state lives in Vue-reactive input state; nested arrays read through
  // it are reactive proxies. Writing those into the graph poisons it for
  // structuredClone consumers (export subgraph clone, undo snapshots) with
  // DataCloneError. Unwrap once — also keeps the drag hot path off proxies.
  const d = toRaw(dragState)
  const { changes, newRect } = resizeChanges(d, cx, cy, constrain, editor, disableSnapping)
  d.appliedRect = { ...newRect }
  if (d.origRect.width > 0 && d.origRect.height > 0) {
    const reflow = reflowedPathTextChanges(
      {
        textPathData: d.origTextPathData,
        textPathBox: d.origTextPathBox,
        derivedTextGlyphs: d.origDerivedTextGlyphs,
        strokes: d.origStrokes
      },
      newRect.width / d.origRect.width,
      newRect.height / d.origRect.height
    )
    if (reflow) Object.assign(changes, reflow)
  }
  editor.graph.updateNodePreview(d.nodeId, changes)
  if (changes.fillGeometry || changes.strokeGeometry || changes.vectorNetwork) {
    editor.renderer?.invalidateVectorPath(d.nodeId)
  }

  // Two passes around the layout run: the first sizes children so Yoga can
  // resolve HUG/FILL, the second re-applies against the settled boxes.
  applyConstrainedChildren(d, newRect, editor)
  editor.graph.runPreviewUpdates(() => computeAllLayouts(editor.graph, d.nodeId))
  applyConstrainedChildren(d, newRect, editor)
  editor.graph.runPreviewUpdates(() => computeAllLayouts(editor.graph, d.nodeId))
  editor.requestRepaint()
}

/**
 * Deep-copy geometry read back from a previewed node — preview values can
 * be reactivity-wrapped, and storing proxies breaks structuredClone snapshots
 * (delete/undo would throw DataCloneError).
 */
function snapshotResizeFinal(node: SceneNode): Partial<SceneNode> {
  const final: Partial<SceneNode> = {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  }
  if (node.vectorNetwork) final.vectorNetwork = cloneVectorNetwork(node.vectorNetwork)
  if (node.fillGeometry.length > 0) final.fillGeometry = copyGeometryPaths(node.fillGeometry)
  // Path-text reflow legitimately EMPTIES strokeGeometry (textPathBox marks
  // those nodes) — commit it so the pre-resize silhouettes don't resurrect.
  // Everything else keeps the length guard: a spurious strokeGeometry key on
  // plain nodes would clear their raw Figma payload on commit.
  if (node.strokeGeometry.length > 0 || node.textPathBox) {
    final.strokeGeometry = copyGeometryPaths(node.strokeGeometry)
  }
  if (node.derivedTextGlyphs?.length) {
    final.derivedTextGlyphs = copyDerivedGlyphs(node.derivedTextGlyphs)
  }
  if (node.textPathBox) final.textPathBox = { ...node.textPathBox }
  if (node.textPathData) final.textPathData = structuredClone(node.textPathData)
  if (node.strokes.length > 0) final.strokes = copyStrokes(node.strokes)
  return final
}

/**
 * Resize commits run inside preserveSourceMetadataDuring so the raw Figma
 * payload (vectorData, textPathStart, effects, ...) survives — but the
 * geometry-derived raw fields are now stale and export PREFERS them over
 * node values (rawSize would resurrect the pre-resize dimensions in the
 * exported file). Invalidate exactly those.
 */
function clearResizedRawGeometry(editor: Editor, nodeId: string): void {
  const node = editor.graph.getNode(nodeId)
  if (!node) return
  node.source.fig.rawSize = null
  node.source.fig.rawTransform = null
  const raw = node.source.fig.rawNodeFields
  delete raw.fillGeometry
  delete raw.strokeGeometry
  delete raw.strokeWeight
  // vectorData is dual-use: for VECTOR nodes it gates nodeForGeometryExport —
  // leaving it makes export pair stale raw vectorData with styleID-less
  // explicit paths (multi-color icons turn gray). For TEXT it is the
  // TEXT_PATH layout path and must survive or reflow dies.
  if (node.type !== 'TEXT') delete raw.vectorData
}

export function commitResizePreview(dragState: DragResize, editor: Editor) {
  // See applyResize — reactive drag state must not leak into graph writes.
  const d = toRaw(dragState)
  optionalEditorState(editor)?.snapGuides.splice(0)
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const finalChanges = snapshotResizeFinal(node)

  if (d.origChildren) {
    const finalChildren = new Map<string, Partial<SceneNode>>()
    for (const [childId] of d.origChildren) {
      const child = editor.graph.getNode(childId)
      if (!child) continue
      finalChildren.set(childId, snapshotResizeFinal(child))
    }
    editor.graph.updateNodePreview(d.nodeId, d.origRect)
    for (const [childId, orig] of d.origChildren) {
      editor.graph.updateNodePreview(childId, {
        x: orig.x,
        y: orig.y,
        width: orig.width,
        height: orig.height,
        vectorNetwork: orig.vectorNetwork,
        fillGeometry: orig.fillGeometry,
        strokeGeometry: orig.strokeGeometry,
        derivedTextGlyphs: orig.derivedTextGlyphs,
        strokes: orig.strokes,
        textPathData: orig.textPathData,
        textPathBox: orig.textPathBox
      })
    }
    // Resize is geometric — the raw Figma import payload (vectorData,
    // textPathStart, effects, ...) must survive or path-text reflow works
    // exactly once and export fidelity degrades.
    editor.graph.preserveSourceMetadataDuring(() => {
      editor.updateNode(d.nodeId, finalChanges)
      for (const [childId, final] of finalChildren) {
        editor.updateNode(childId, final)
      }
    })
    clearResizedRawGeometry(editor, d.nodeId)
    for (const [childId] of finalChildren) clearResizedRawGeometry(editor, childId)
    editor.commitGroupResize(d.nodeId, d.origRect, d.origChildren)
    editor.requestRepaint()
  } else {
    editor.graph.updateNodePreview(d.nodeId, d.origRect)
    // See the group branch — raw import payload survives geometric commits.
    editor.graph.preserveSourceMetadataDuring(() => {
      editor.updateNode(d.nodeId, finalChanges)
    })
    clearResizedRawGeometry(editor, d.nodeId)
    const original: Parameters<typeof editor.commitResize>[1] = { ...d.origRect }
    if (d.origVectorNetwork || node.vectorNetwork) original.vectorNetwork = d.origVectorNetwork
    if (d.origFillGeometry.length > 0) original.fillGeometry = d.origFillGeometry
    if (d.origStrokeGeometry.length > 0) original.strokeGeometry = d.origStrokeGeometry
    if (d.origDerivedTextGlyphs?.length) original.derivedTextGlyphs = d.origDerivedTextGlyphs
    if (d.origStrokes.length > 0) original.strokes = d.origStrokes
    if (d.origTextPathData) original.textPathData = d.origTextPathData
    if (d.origTextPathBox) original.textPathBox = d.origTextPathBox
    editor.commitResize(d.nodeId, original)
  }
}
