export { constrainToAspectRatio } from '#vue/shared/input/resize/rect'
export { tryStartResize } from '#vue/shared/input/resize/start'
import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { computeLayout } from '@open-pencil/core/layout'
import {
  calibratePathTextLayout,
  getTextPathData,
  reflowPathTextGlyphs
} from '@open-pencil/core/text'
import { cloneVectorNetwork } from '@open-pencil/scene-graph'
import type { FigmaDerivedTextGlyph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import {
  copyGeometryPaths,
  copyStroke,
  copyStrokes,
  scaleGeometryPaths
} from '@open-pencil/scene-graph/copy'

import { calculateResizeRect } from '#vue/shared/input/resize/rect'
import { scaleVectorNetworkForResize } from '#vue/shared/input/resize/vector'
import type { DragResize, OrigChildState } from '#vue/shared/input/types'

/**
 * Resize path-text glyphs without baking anisotropic scale into fontSize.
 * commandsBlob stays in font units; paint multiplies by fontSize then scaleX/Y.
 * Accumulating scaleX/Y (not fontSize *= avg) keeps non-uniform stretch correct
 * under rotation — see drawFigmaDerivedText transform order.
 */
function scaleDerivedGlyphs(
  glyphs: FigmaDerivedTextGlyph[] | null,
  sx: number,
  sy: number
): FigmaDerivedTextGlyph[] | null {
  if (!glyphs?.length) return glyphs
  return glyphs.map((g) => ({
    ...g,
    x: g.x * sx,
    y: g.y * sy,
    scaleX: (g.scaleX ?? 1) * sx,
    scaleY: (g.scaleY ?? 1) * sy,
    commandsBlob: new Uint8Array(g.commandsBlob)
  }))
}

function scaleStrokes(strokes: Stroke[], sx: number, sy: number): Stroke[] {
  if (strokes.length === 0) return strokes
  // Weight is a scalar; average scale is the usual 2D → 1D compromise.
  const weightScale = (Math.abs(sx) + Math.abs(sy)) / 2
  return strokes.map((s) => ({ ...copyStroke(s), weight: s.weight * weightScale }))
}

/**
 * Figma resize semantics for imported text-on-path: constant font size,
 * glyphs re-placed along the scaled path (see core/text/path-layout). Used
 * instead of geometric glyph/silhouette scaling whenever the node still has
 * its layout path. Baked node-level silhouettes cannot follow re-placed
 * glyphs, so strokeGeometry is cleared — the renderer rebuilds silhouettes
 * per glyph — and stroke weight stays constant like the font size.
 */
function reflowedPathTextChanges(
  editor: Editor,
  nodeId: string,
  orig: Pick<OrigChildState, 'textPathBox' | 'figmaDerivedTextGlyphs' | 'strokes'>,
  sx: number,
  sy: number
): Partial<SceneNode> | null {
  if (!orig.textPathBox || !orig.figmaDerivedTextGlyphs?.length) return null
  const node = editor.graph.getNode(nodeId)
  if (!node) return null
  const data = getTextPathData(node)
  if (!data) return null
  const layout = calibratePathTextLayout(orig.figmaDerivedTextGlyphs, data, orig.textPathBox)
  if (!layout) return null
  const box = {
    x: orig.textPathBox.x * sx,
    y: orig.textPathBox.y * sy,
    width: orig.textPathBox.width * sx,
    height: orig.textPathBox.height * sy
  }
  const glyphs = reflowPathTextGlyphs(orig.figmaDerivedTextGlyphs, data, layout, box)
  if (!glyphs) return null
  return {
    figmaDerivedTextGlyphs: glyphs,
    textPathBox: box,
    strokeGeometry: [],
    strokes: copyStrokes(orig.strokes)
  }
}

/**
 * All geometry that must track a width/height change. Historically only
 * vectorNetwork + fillGeometry were updated — path-text strokeGeometry and
 * glyphs stayed at the pre-resize size, so shrinking a sticker made the white
 * OUTSIDE outlines look massively thick (DomeSticker resize bug).
 */
function scaledGeometryChanges(
  orig: Pick<
    OrigChildState,
    'vectorNetwork' | 'fillGeometry' | 'strokeGeometry' | 'figmaDerivedTextGlyphs' | 'strokes'
  >,
  origWidth: number,
  origHeight: number,
  width: number,
  height: number
): Partial<SceneNode> {
  if (origWidth <= 0 || origHeight <= 0) return {}
  const sx = width / origWidth
  const sy = height / origHeight
  if (sx === 1 && sy === 1) return {}

  const changes: Partial<SceneNode> = {}
  const resizedVN = scaleVectorNetworkForResize(
    orig.vectorNetwork,
    origWidth,
    origHeight,
    width,
    height
  )
  if (resizedVN) changes.vectorNetwork = resizedVN
  if (orig.fillGeometry.length > 0) {
    changes.fillGeometry = scaleGeometryPaths(orig.fillGeometry, sx, sy)
  }

  if (orig.strokeGeometry.length > 0) {
    changes.strokeGeometry = scaleGeometryPaths(orig.strokeGeometry, sx, sy)
  }
  if (orig.figmaDerivedTextGlyphs?.length) {
    changes.figmaDerivedTextGlyphs = scaleDerivedGlyphs(orig.figmaDerivedTextGlyphs, sx, sy)
  }
  if (orig.strokes.length > 0) {
    changes.strokes = scaleStrokes(orig.strokes, sx, sy)
  }
  return changes
}

function resizeChanges(d: DragResize, cx: number, cy: number, constrain: boolean) {
  const { origRect } = d
  const newRect = calculateResizeRect(d.handle, origRect, cx - d.startX, cy - d.startY, constrain)

  const changes: Partial<SceneNode> = {
    ...newRect,
    ...scaledGeometryChanges(
      {
        vectorNetwork: d.origVectorNetwork,
        fillGeometry: d.origFillGeometry,
        strokeGeometry: d.origStrokeGeometry,
        figmaDerivedTextGlyphs: d.origFigmaDerivedTextGlyphs,
        strokes: d.origStrokes
      },
      origRect.width,
      origRect.height,
      newRect.width,
      newRect.height
    )
  }
  return { changes, newRect }
}

function applyChildResizes(d: DragResize, editor: Editor, sx: number, sy: number) {
  if (!d.origChildren) return
  for (const [childId, orig] of d.origChildren) {
    const childWidth = Math.round(Math.max(1, orig.width * sx))
    const childHeight = Math.round(Math.max(1, orig.height * sy))
    const childChanges: Partial<SceneNode> = {
      x: Math.round(orig.x * sx),
      y: Math.round(orig.y * sy),
      width: childWidth,
      height: childHeight,
      ...scaledGeometryChanges(orig, orig.width, orig.height, childWidth, childHeight)
    }
    if (orig.width > 0 && orig.height > 0) {
      const reflow = reflowedPathTextChanges(
        editor,
        childId,
        orig,
        childWidth / orig.width,
        childHeight / orig.height
      )
      if (reflow) Object.assign(childChanges, reflow)
    }
    editor.graph.updateNodePreview(childId, childChanges)
    if (childChanges.fillGeometry || childChanges.strokeGeometry || childChanges.vectorNetwork) {
      editor.renderer?.invalidateVectorPath(childId)
    }
  }
}

export function applyResize(
  dragState: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  editor: Editor
) {
  // Drag state lives in Vue-reactive input state; nested arrays read through
  // it are reactive proxies. Writing those into the graph poisons it for
  // structuredClone consumers (export subgraph clone, undo snapshots) with
  // DataCloneError. Unwrap once — also keeps the drag hot path off proxies.
  const d = toRaw(dragState)
  const { changes, newRect } = resizeChanges(d, cx, cy, constrain)
  if (d.origRect.width > 0 && d.origRect.height > 0) {
    const sx = newRect.width / d.origRect.width
    const sy = newRect.height / d.origRect.height
    const reflow = reflowedPathTextChanges(
      editor,
      d.nodeId,
      {
        textPathBox: d.origTextPathBox,
        figmaDerivedTextGlyphs: d.origFigmaDerivedTextGlyphs,
        strokes: d.origStrokes
      },
      sx,
      sy
    )
    if (reflow) Object.assign(changes, reflow)
    editor.graph.updateNodePreview(d.nodeId, changes)
    applyChildResizes(d, editor, sx, sy)
  } else {
    editor.graph.updateNodePreview(d.nodeId, changes)
  }
  if (changes.fillGeometry || changes.strokeGeometry || changes.vectorNetwork) {
    editor.renderer?.invalidateVectorPath(d.nodeId)
  }

  const node = editor.graph.getNode(d.nodeId)
  if (node?.layoutMode !== 'NONE') {
    editor.graph.runPreviewUpdates(() => computeLayout(editor.graph, d.nodeId))
  }
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
  if (node.figmaDerivedTextGlyphs?.length) {
    final.figmaDerivedTextGlyphs = node.figmaDerivedTextGlyphs.map((g) => ({
      ...g,
      commandsBlob: new Uint8Array(g.commandsBlob)
    }))
  }
  if (node.textPathBox) final.textPathBox = { ...node.textPathBox }
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
        figmaDerivedTextGlyphs: orig.figmaDerivedTextGlyphs,
        strokes: orig.strokes,
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
    editor.commitResize(d.nodeId, {
      ...d.origRect,
      ...(d.origVectorNetwork || node.vectorNetwork ? { vectorNetwork: d.origVectorNetwork } : {}),
      ...(d.origFillGeometry.length > 0 ? { fillGeometry: d.origFillGeometry } : {}),
      ...(d.origStrokeGeometry.length > 0 ? { strokeGeometry: d.origStrokeGeometry } : {}),
      ...(d.origFigmaDerivedTextGlyphs?.length
        ? { figmaDerivedTextGlyphs: d.origFigmaDerivedTextGlyphs }
        : {}),
      ...(d.origStrokes.length > 0 ? { strokes: d.origStrokes } : {}),
      ...(d.origTextPathBox ? { textPathBox: d.origTextPathBox } : {})
    })
  }
}
