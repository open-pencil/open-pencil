import { ROTATION_HANDLE_DISTANCE } from '@open-pencil/core/constants'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { applyFixtureTransform, nestedGeometryData } from '#tests/helpers/geometry'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

for (const flipX of [false, true]) {
  for (const flipY of [false, true]) {
    test(`nested rotation, labels and cancellation (flipX=${flipX}, flipY=${flipY})`, async () => {
      const data = nestedGeometryData(flipX, flipY)
      const id = await editor.page.evaluate((fixture) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        const s = fixture.section
        const sectionId = store.createShape('SECTION', s.x, s.y, s.width, s.height)
        store.updateNode(sectionId, s)
        const frame = store.graph.createNode('FRAME', sectionId, {
          ...fixture.frame,
          fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
        })
        store.graph.createNode('RECTANGLE', frame.id, {
          name: 'Asymmetric content',
          x: 15,
          y: 14,
          width: 70,
          height: 30,
          cornerRadius: 6,
          fills: [
            { type: 'SOLID', color: { r: 0.85, g: 0.25, b: 0.3, a: 1 }, opacity: 1, visible: true }
          ]
        })
        store.select([frame.id])
        store.requestRender()
        return frame.id
      }, data)
      await editor.canvas.waitForRender()
      const bounds = expectDefined(
        await editor.page.getByTestId('canvas-element').boundingBox(),
        'canvas bounds'
      )
      const viewport = await editor.page.evaluate(() => {
        const state = window.openPencil?.getStore?.().state
        if (!state) throw new Error('Editor unavailable')
        return { zoom: state.zoom, panX: state.panX, panY: state.panY }
      })
      const world = (point: Vector) =>
        applyFixtureTransform(data.section, applyFixtureTransform(data.frame, point))
      const center = world({ x: data.frame.width / 2, y: data.frame.height / 2 })
      const stalkOffset = ROTATION_HANDLE_DISTANCE / viewport.zoom
      const reflectedY = data.section.flipY !== data.frame.flipY
      const start = world({
        x: data.frame.width / 2,
        y: reflectedY ? data.frame.height + stalkOffset : -stalkOffset
      })
      const radians = Math.PI / 6
      const dx = start.x - center.x
      const dy = start.y - center.y
      const end = {
        x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
        y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians)
      }
      const move = async (point: Vector, steps = 1) =>
        editor.page.mouse.move(
          bounds.x + viewport.panX + point.x * viewport.zoom,
          bounds.y + viewport.panY + point.y * viewport.zoom,
          { steps }
        )
      await move(start)
      await editor.canvas.waitForRender()
      const original = await editor.canvas.screenshotCanvasRegion()
      await editor.page.mouse.down()
      try {
        await move(end, 8)
        await editor.canvas.waitForRender()
        const held = await editor.page.evaluate((nodeId) => {
          const store = window.openPencil?.getStore?.()
          return {
            rotation: store?.graph.getNode(nodeId)?.rotation,
            preview: store?.state.rotationPreview
          }
        }, id)
        expect(held.rotation).toBe(data.frame.rotation)
        const preview = expectDefined(held.preview, 'held rotation')
        expect(preview.nodeId).toBe(id)
        expect(Math.sign(preview.angle - data.frame.rotation)).toBe(flipX === flipY ? 1 : -1)
        expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
          `nested-transform-${flipX}-${flipY}-held.png`,
          { maxDiffPixelRatio: 0, threshold: 0 }
        )
        await editor.page.keyboard.press('Escape')
        await editor.canvas.waitForRender()
        expect(
          await editor.page.evaluate(() => window.openPencil?.getStore?.().state.rotationPreview)
        ).toBeNull()
        expect(
          await editor.page.evaluate(() => [
            ...(window.openPencil?.getStore?.().state.selectedIds ?? [])
          ])
        ).toEqual([id])
        await editor.page.mouse.up()
        // Compare the restored scene with the pointer (and therefore hover) back in the same place.
        await move(start)
        await editor.canvas.waitForRender()
        expect((await editor.canvas.screenshotCanvasRegion()).equals(original)).toBe(true)
        await editor.page.mouse.down()
        await move(end, 8)
        const committedAngle = expectDefined(
          await editor.page.evaluate(
            () => window.openPencil?.getStore?.().state.rotationPreview?.angle
          ),
          'preview angle'
        )
        await editor.page.mouse.up()
        await editor.canvas.waitForRender()
        expect(
          await editor.page.evaluate(
            (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.rotation,
            id
          )
        ).toBe(committedAngle)
        await editor.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
        expect(
          await editor.page.evaluate(
            (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.rotation,
            id
          )
        ).toBe(data.frame.rotation)
        await editor.page.evaluate(() => window.openPencil?.getStore?.().redoAction())
        expect(
          await editor.page.evaluate(
            (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.rotation,
            id
          )
        ).toBe(committedAngle)
        editor.canvas.assertNoErrors()
      } finally {
        await editor.page.mouse.up()
      }
    })
  }
}
