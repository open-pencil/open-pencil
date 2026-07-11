import type { Editor } from '@open-pencil/core/editor'
import { cloneVectorNetwork } from '@open-pencil/scene-graph'
import type { FigmaDerivedTextGlyph, SceneNode } from '@open-pencil/scene-graph'
import { copyGeometryPaths, copyStrokes } from '@open-pencil/scene-graph/copy'

import { getHitHandleByMatrix } from '#vue/shared/input/geometry'
import type { DragResize, OrigChildState } from '#vue/shared/input/types'

function copyDerivedGlyphs(glyphs: FigmaDerivedTextGlyph[] | null): FigmaDerivedTextGlyph[] | null {
  if (!glyphs) return null
  return glyphs.map((g) => ({
    ...g,
    commandsBlob: new Uint8Array(g.commandsBlob)
  }))
}

function snapshotNodeGeometry(node: SceneNode): OrigChildState {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    vectorNetwork: node.vectorNetwork ? cloneVectorNetwork(node.vectorNetwork) : null,
    fillGeometry: copyGeometryPaths(node.fillGeometry),
    strokeGeometry: copyGeometryPaths(node.strokeGeometry),
    figmaDerivedTextGlyphs: copyDerivedGlyphs(node.figmaDerivedTextGlyphs),
    strokes: copyStrokes(node.strokes)
  }
}

function collectDescendants(id: string, editor: Editor): Map<string, OrigChildState> | null {
  const node = editor.graph.getNode(id)
  if (!node) return null
  // Groups/booleans already scaled children. Freeform frames (layoutMode NONE)
  // did not — resizing DomeSticker only changed the clipsContent box while the
  // icon+path-text stayed full size, so lettering was hard-clipped. Auto-layout
  // frames are excluded: children should reflow, not geometric-scale.
  const scalesChildren =
    node.type === 'GROUP' ||
    node.type === 'BOOLEAN_OPERATION' ||
    (node.type === 'FRAME' && node.layoutMode === 'NONE')
  if (!scalesChildren) return null
  const map = new Map<string, OrigChildState>()
  const stack = [...node.childIds]
  while (stack.length > 0) {
    const childId = stack.pop()
    if (childId === undefined) break
    const child = editor.graph.getNode(childId)
    if (!child) continue
    map.set(childId, snapshotNodeGeometry(child))
    stack.push(...child.childIds)
  }
  return map.size > 0 ? map : null
}

export function tryStartResize(cx: number, cy: number, editor: Editor): DragResize | null {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node || node.locked) continue
    const handleResult = getHitHandleByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom)
    if (handleResult) {
      const snap = snapshotNodeGeometry(node)
      return {
        type: 'resize',
        handle: handleResult.handle,
        startX: cx,
        startY: cy,
        origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
        nodeId: id,
        origVectorNetwork: snap.vectorNetwork,
        origFillGeometry: snap.fillGeometry,
        origStrokeGeometry: snap.strokeGeometry,
        origFigmaDerivedTextGlyphs: snap.figmaDerivedTextGlyphs,
        origStrokes: snap.strokes,
        origChildren: collectDescendants(id, editor)
      }
    }
  }
  return null
}
