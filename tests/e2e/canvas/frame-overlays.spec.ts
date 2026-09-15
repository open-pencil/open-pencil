import { writeFile } from 'node:fs/promises'

import { CORNER_ROTATE_ZONE, HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot(`${name}.png`, { maxDiffPixelRatio: 0, threshold: 0 })
}

async function createOverlayDemo(rotation: number) {
  await editor.page.evaluate((frameRotation) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId

    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Typography',
      x: 140,
      y: 140,
      width: 300,
      height: 120,
      rotation: frameRotation,
      cornerRadius: 16,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }],
      strokes: []
    })

    store.graph.createNode('TEXT', frame.id, {
      name: 'Heading',
      text: 'Heading',
      x: 24,
      y: 20,
      width: 120,
      height: 32,
      fontSize: 22,
      fontWeight: 700,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })

    store.graph.createNode('TEXT', frame.id, {
      name: 'Body',
      text: 'The quick brown fox jumps.',
      x: 24,
      y: 62,
      width: 220,
      height: 24,
      fontSize: 14,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })

    const hoverTarget = store.graph.createNode('RECTANGLE', frame.id, {
      name: 'Hover Target',
      x: 210,
      y: 28,
      width: 56,
      height: 40,
      cornerRadius: 10,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.42, g: 0.78, b: 0.58, a: 1 },
          visible: true,
          opacity: 1
        }
      ]
    })

    store.select([frame.id])
    store.state.hoveredNodeId = hoverTarget.id
    store.requestRender()
  }, rotation)

  await editor.canvas.waitForRender()
}

test('rotated frame selection labels render with hovered child', async () => {
  await createOverlayDemo(18)
  const settled = await editor.canvas.screenshotCanvasRegion()
  const release = await editor.page.evaluateHandle(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    return store.beginInteractiveEdit()
  })
  try {
    await editor.canvas.waitForRender()
    expect((await editor.canvas.screenshotCanvasRegion()).equals(settled)).toBe(true)
  } finally {
    await release.evaluate((stop) => stop())
    await release.dispose()
  }
  await expectCanvas('rotated-frame-selection-labels')
})

test('rotation preview updates frame labels before mouse up', async () => {
  await createOverlayDemo(0)

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const frameId = [...store.state.selectedIds][0]
    store.setRotationPreview({ nodeId: frameId, angle: 28 })
  })

  await editor.canvas.waitForRender()
  await expectCanvas('rotated-frame-selection-labels-preview')
})

test('hover highlight stays aligned for child inside rotated frame', async () => {
  await createOverlayDemo(28)
  await expectCanvas('rotated-frame-child-hover-highlight')
})

test('nested frame labels use the parent transform during rotation preview', async () => {
  const id = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const sectionId = store.createShape('SECTION', 140, 140, 500, 350)
    store.updateNode(sectionId, { name: 'Rotated section', rotation: 25 })
    const frame = store.graph.createNode('FRAME', sectionId, {
      name: 'Nested frame',
      x: 100,
      y: 100,
      width: 220,
      height: 120,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.select([frame.id])
    store.setRotationPreview({ nodeId: frame.id, angle: -55 })
    store.requestRender()
    return frame.id
  })
  await editor.canvas.waitForRender()
  await expectCanvas('nested-frame-rotation-preview')
  const during = await editor.canvas.screenshotCanvasRegion()
  await editor.page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    store.updateNode(nodeId, { rotation: -55 })
    store.setRotationPreview(null)
  }, id)
  await editor.canvas.waitForRender()
  const after = await editor.canvas.screenshotCanvasRegion()
  await writeFile(test.info().outputPath('nested-frame-held.png'), during)
  await writeFile(test.info().outputPath('nested-frame-released.png'), after)
  expect(after.equals(during)).toBe(true)
})

for (const angle of [-32, 32]) {
  test(`labels follow a held ${angle}-degree corner rotation without jumping on release`, async () => {
    const id = await editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
        name: 'Frame',
        x: 240,
        y: 220,
        width: 300,
        height: 180,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
      })
      store.select([frame.id])
      store.requestRender()
      return frame.id
    })
    await editor.canvas.waitForRender()
    const bounds = expectDefined(
      await editor.page.getByTestId('canvas-element').boundingBox(),
      'canvas bounds'
    )
    const viewport = await editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      return { zoom: store.state.zoom, panX: store.state.panX, panY: store.state.panY }
    })
    const cornerOffset = (HANDLE_HIT_RADIUS + CORNER_ROTATE_ZONE) / (2 * Math.SQRT2)
    const centerX = bounds.x + viewport.panX + 390 * viewport.zoom
    const centerY = bounds.y + viewport.panY + 310 * viewport.zoom
    const dx = -150 * viewport.zoom - cornerOffset
    const dy = -90 * viewport.zoom - cornerOffset
    await editor.page.mouse.move(centerX + dx, centerY + dy)
    await editor.page.mouse.down()
    try {
      const radians = (angle * Math.PI) / 180
      await editor.page.mouse.move(
        centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
        centerY + dx * Math.sin(radians) + dy * Math.cos(radians),
        { steps: 8 }
      )
      await editor.canvas.waitForRender()
      const held = await editor.page.evaluate((nodeId) => {
        const store = window.openPencil?.getStore?.()
        return {
          rotation: store?.graph.getNode(nodeId)?.rotation,
          preview: store?.state.rotationPreview
        }
      }, id)
      expect(held.rotation).toBe(0)
      expect(held.preview?.nodeId).toBe(id)
      const preview = expectDefined(held.preview, 'held rotation preview')
      // Browser pointer coordinates are quantized; test the actual held angle,
      // not the ideal angle used to generate the pointer destination.
      expect(Math.sign(preview.angle)).toBe(Math.sign(angle))
      const during = await editor.canvas.screenshotCanvasRegion()
      expect(during).toMatchSnapshot(`frame-held-rotation-${angle}.png`, {
        maxDiffPixelRatio: 0,
        threshold: 0
      })
      await editor.page.mouse.up()
      await editor.canvas.waitForRender()
      expect((await editor.canvas.screenshotCanvasRegion()).equals(during)).toBe(true)
      await editor.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
      expect(
        await editor.page.evaluate(
          (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.rotation,
          id
        )
      ).toBe(0)
      await editor.page.evaluate(() => window.openPencil?.getStore?.().redoAction())
      expect(
        await editor.page.evaluate(
          (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.rotation,
          id
        )
      ).toBe(preview.angle)
      editor.canvas.assertNoErrors()
    } finally {
      await editor.page.mouse.up()
    }
  })
}
