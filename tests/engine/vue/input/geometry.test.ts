import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  createSceneGeometry,
  rotationHandleLayout,
  selectionHandleRect
} from '@open-pencil/core/geometry'

import {
  canvasToLocalPoint,
  getHitHandleByMatrix,
  hitTestCornerRotationByMatrix,
  hitTestTopRotationHandleByMatrix
} from '#vue/shared/input/geometry'

import { nestedGeometryFixture } from '#tests/helpers/geometry'

for (const flipX of [false, true]) {
  for (const flipY of [false, true]) {
    test(`nested handle and scope hits follow drawing (flipX=${flipX}, flipY=${flipY})`, () => {
      const editor = createEditor()
      try {
        const { section, frame } = nestedGeometryFixture(
          editor.graph,
          editor.state.currentPageId,
          flipX,
          flipY
        )
        const geometry = createSceneGeometry(editor.graph)
        const zoom = 2
        const handles = geometry.handles(frame, selectionHandleRect(frame))
        for (const [key, point] of Object.entries(handles)) {
          expect(getHitHandleByMatrix(point.x, point.y, frame, editor.graph, zoom)?.handle).toBe(
            key
          )
        }
        const stalk = rotationHandleLayout(frame, geometry, zoom)
        expect(stalk.edge.y).toBe(flipY ? frame.height : 0)
        expect(stalk.handle.y).toBe(flipY ? frame.height + 12 : -12)
        const top = geometry.toWorld(frame, stalk.handle)
        expect(hitTestTopRotationHandleByMatrix(top.x, top.y, frame, editor.graph, zoom)).toBe(true)
        expect(
          hitTestTopRotationHandleByMatrix(handles.n.x, handles.n.y, frame, editor.graph, zoom)
        ).toBe(false)
        const outside = geometry.toWorld(frame, { x: -5, y: -5 })
        expect(hitTestCornerRotationByMatrix(outside.x, outside.y, frame, editor.graph, zoom)).toBe(
          'nw'
        )
        const inside = geometry.toWorld(frame, { x: 5, y: 5 })
        expect(
          hitTestCornerRotationByMatrix(inside.x, inside.y, frame, editor.graph, zoom)
        ).toBeNull()
        const point = geometry.toWorld(frame, { x: 35, y: 22 })
        const local = canvasToLocalPoint(point.x, point.y, frame.id, editor)
        expect(local.lx).toBeCloseTo(35, 9)
        expect(local.ly).toBeCloseTo(22, 9)
        editor.setRotationPreview({ nodeId: section.id, angle: 75 })
        const preview = createSceneGeometry(editor.graph, editor.state.rotationPreview)
        const heldCorner = preview.handles(frame).nw
        expect(
          getHitHandleByMatrix(
            heldCorner.x,
            heldCorner.y,
            frame,
            editor.graph,
            zoom,
            editor.state.rotationPreview
          )?.handle
        ).toBe('nw')
        const heldTop = preview.toWorld(frame, rotationHandleLayout(frame, preview, zoom).handle)
        expect(
          hitTestTopRotationHandleByMatrix(
            heldTop.x,
            heldTop.y,
            frame,
            editor.graph,
            zoom,
            editor.state.rotationPreview
          )
        ).toBe(true)
        const moved = preview.toWorld(frame, { x: 35, y: 22 })
        const previewLocal = canvasToLocalPoint(moved.x, moved.y, frame.id, editor)
        expect(previewLocal.lx).toBeCloseTo(35, 9)
        expect(previewLocal.ly).toBeCloseTo(22, 9)
        editor.setRotationPreview(null)
        expect(canvasToLocalPoint(point.x, point.y, frame.id, editor)).toEqual(local)
      } finally {
        editor.dispose()
      }
    })
  }
}
