export { constrainToAspectRatio } from '#vue/shared/input/resize/rect'
export { tryStartResize } from '#vue/shared/input/resize/start'
import type { Editor } from '@open-pencil/core/editor'
import { computeLayout } from '@open-pencil/core/layout'
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

function scaleDerivedGlyphs(
  glyphs: FigmaDerivedTextGlyph[] | null,
  sx: number,
  sy: number
): FigmaDerivedTextGlyph[] | null {
  if (!glyphs?.length) return glyphs
  // commandsBlob is font-unit outline; paint uses fontSize then optional scaleX/Y.
  // Keep fontSize, accumulate scaleX/Y so non-uniform stretch matches strokeGeometry
  // (S(sx,sy) must apply outside glyph rotation).
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
  const weightScale = (Math.abs(sx) + Math.abs(sy)) / 2
  return strokes.map((s) => ({ ...copyStroke(s), weight: s.weight * weightScale }))
}

/** Geometry that must track node scale (path text stroke + vector stroke blobs). */
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
  // fillGeometry blobs must track the scaled node or exports keep the old size.
  if (orig.fillGeometry.length > 0) {
    changes.fillGeometry = scaleGeometryPaths(orig.fillGeometry, sx, sy)
  }

  // strokeGeometry is pre-expanded outline (path text white OUTSIDE stroke).
  // If we only scale width/height, outlines stay full-size and look huge.
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

export function applyResize(
  d: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  editor: Editor
) {
  const { changes, newRect } = resizeChanges(d, cx, cy, constrain)
  editor.graph.updateNodePreview(d.nodeId, changes)
  if (changes.fillGeometry || changes.strokeGeometry || changes.vectorNetwork) {
    editor.renderer?.invalidateVectorPath(d.nodeId)
  }

  if (d.origChildren && d.origRect.width > 0 && d.origRect.height > 0) {
    const sx = newRect.width / d.origRect.width
    const sy = newRect.height / d.origRect.height
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
      editor.graph.updateNodePreview(childId, childChanges)
      if (childChanges.fillGeometry || childChanges.strokeGeometry || childChanges.vectorNetwork) {
        editor.renderer?.invalidateVectorPath(childId)
      }
    }
  }

  const node = editor.graph.getNode(d.nodeId)
  if (node?.layoutMode !== 'NONE') {
    editor.graph.runPreviewUpdates(() => computeLayout(editor.graph, d.nodeId))
  }
  editor.requestRepaint()
}

export function commitResizePreview(d: DragResize, editor: Editor) {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const finalChanges: Partial<SceneNode> = {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  }
  // Deep-copy geometry read back from the previewed node — preview values can
  // be reactivity-wrapped, and storing proxies breaks structuredClone snapshots
  // (delete/undo would throw DataCloneError).
  if (node.vectorNetwork) finalChanges.vectorNetwork = cloneVectorNetwork(node.vectorNetwork)
  if (node.fillGeometry.length > 0) finalChanges.fillGeometry = copyGeometryPaths(node.fillGeometry)
  if (node.strokeGeometry.length > 0)
    finalChanges.strokeGeometry = copyGeometryPaths(node.strokeGeometry)
  if (node.figmaDerivedTextGlyphs?.length) {
    finalChanges.figmaDerivedTextGlyphs = node.figmaDerivedTextGlyphs.map((g) => ({
      ...g,
      commandsBlob: new Uint8Array(g.commandsBlob)
    }))
  }
  if (node.strokes.length > 0) finalChanges.strokes = copyStrokes(node.strokes)

  if (d.origChildren) {
    const finalChildren = new Map<string, Partial<SceneNode>>()
    for (const [childId] of d.origChildren) {
      const child = editor.graph.getNode(childId)
      if (!child) continue
      const final: Partial<SceneNode> = {
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height
      }
      if (child.vectorNetwork) final.vectorNetwork = cloneVectorNetwork(child.vectorNetwork)
      if (child.fillGeometry.length > 0) final.fillGeometry = copyGeometryPaths(child.fillGeometry)
      if (child.strokeGeometry.length > 0)
        final.strokeGeometry = copyGeometryPaths(child.strokeGeometry)
      if (child.figmaDerivedTextGlyphs?.length) {
        final.figmaDerivedTextGlyphs = child.figmaDerivedTextGlyphs.map((g) => ({
          ...g,
          commandsBlob: new Uint8Array(g.commandsBlob)
        }))
      }
      if (child.strokes.length > 0) final.strokes = copyStrokes(child.strokes)
      finalChildren.set(childId, final)
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
        strokes: orig.strokes
      })
    }
    editor.updateNode(d.nodeId, finalChanges)
    for (const [childId, final] of finalChildren) {
      editor.updateNode(childId, final)
    }
    editor.commitGroupResize(d.nodeId, d.origRect, d.origChildren)
    editor.requestRepaint()
  } else {
    editor.graph.updateNodePreview(d.nodeId, d.origRect)
    editor.updateNode(d.nodeId, finalChanges)
    editor.commitResize(d.nodeId, {
      ...d.origRect,
      ...(d.origVectorNetwork || node.vectorNetwork ? { vectorNetwork: d.origVectorNetwork } : {}),
      ...(d.origFillGeometry.length > 0 ? { fillGeometry: d.origFillGeometry } : {}),
      ...(d.origStrokeGeometry.length > 0 ? { strokeGeometry: d.origStrokeGeometry } : {}),
      ...(d.origFigmaDerivedTextGlyphs?.length
        ? { figmaDerivedTextGlyphs: d.origFigmaDerivedTextGlyphs }
        : {}),
      ...(d.origStrokes.length > 0 ? { strokes: d.origStrokes } : {})
    })
  }
}
