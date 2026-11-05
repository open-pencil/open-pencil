import type { Page } from '@playwright/test'
import { fromUint8Array } from 'js-base64'

import { expectDefined } from '@open-pencil/test-support/assert'

import { CanvasHelper } from '#tests/helpers/canvas'

export interface TiledSubmission {
  sceneRenderer: string
  presentedTiles: number
}

export function flippedSubtreesDriver(page: () => Page) {
  async function settle() {
    await page().evaluate(async () => {
      const hooks = window.openPencil?.test?.navigation
      if (!hooks) throw new Error('Navigation hooks unavailable')
      await hooks.waitForSettlement()
    })
  }

  async function crop() {
    const box = expectDefined(
      await page().getByTestId('canvas-element').boundingBox(),
      'canvas bounds'
    )
    return page().screenshot({ clip: { x: box.x, y: box.y, width: 640, height: 600 } })
  }

  return {
    differentPixels(a: Uint8Array, b: Uint8Array, tolerance = 8): Promise<number> {
      return page().evaluate(
        async ({ pngs, tolerance }) => {
          const images = await Promise.all(
            pngs.map(async (base64) => {
              const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
              const bitmap = await createImageBitmap(blob)
              const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
              const context = canvas.getContext('2d')
              if (!context) throw new Error('2D context unavailable')
              context.drawImage(bitmap, 0, 0)
              return context.getImageData(0, 0, bitmap.width, bitmap.height).data
            })
          )
          const [first, second] = images
          let different = 0
          for (let offset = 0; offset < first.length; offset += 4) {
            for (let channel = 0; channel < 4; channel++) {
              if (Math.abs(first[offset + channel] - second[offset + channel]) > tolerance) {
                different++
                break
              }
            }
          }
          return different
        },
        { pngs: [fromUint8Array(a), fromUint8Array(b)], tolerance }
      )
    },

    async show(): Promise<void> {
      await page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const hooks = window.openPencil?.test?.navigation
        if (!store || !hooks) throw new Error('Editor unavailable')
        hooks.startRecording('tiled-flipped-subtrees')
        store.setZoomAroundPoint(1, 0, 0)
        store.pan(-store.state.panX, -store.state.panY)
        const pageId = store.state.currentPageId
        const solid = (r: number, g: number, b: number) => [
          { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
        ]
        const flips = [
          { flipX: true, flipY: false, rotation: 0 },
          { flipX: false, flipY: true, rotation: 0 },
          { flipX: true, flipY: true, rotation: 0 },
          { flipX: true, flipY: false, rotation: 25 }
        ]
        const frames = [false, true].flatMap((clipsContent, row) =>
          flips.map((flip, column) => ({
            ...flip,
            clipsContent,
            x: 40 + column * 140,
            y: 40 + row * 140
          }))
        )
        for (const placement of frames) {
          const frame = store.graph.createNode('FRAME', pageId, {
            ...placement,
            width: 110,
            height: 70,
            fills: solid(0.93, 0.93, 0.96)
          })
          for (const corner of [
            { x: 2, y: 2 },
            { x: 99, y: 2 },
            { x: 2, y: 59 },
            { x: 99, y: 59 }
          ]) {
            store.graph.createNode('RECTANGLE', frame.id, {
              ...corner,
              width: 9,
              height: 9,
              fills: solid(0.85, 0.1, 0.1)
            })
          }
        }
        for (const straddler of [
          { x: 490, y: 360, flipX: true, flipY: false },
          { x: 300, y: 490, flipX: false, flipY: true },
          { x: 490, y: 490, flipX: true, flipY: true }
        ]) {
          store.graph.createNode('RECTANGLE', pageId, {
            ...straddler,
            width: 44,
            height: 44,
            fills: solid(0.1, 0.45, 0.85)
          })
        }
        store.clearSelection()
        store.requestRender()
      })
      await settle()
    },

    async tiled() {
      await settle()
      const pixels = await crop()
      const submission = await page().evaluate((): TiledSubmission => {
        const hooks = window.openPencil?.test?.navigation
        if (!hooks) throw new Error('Navigation hooks unavailable')
        const recording = hooks.stopRecording()
        const presented = recording.trace
          .filter(({ detail }) => detail.layer === 'tiled-scheduler' && detail.remaining === 0)
          .map(({ detail }) => detail.presentedTileCount)
          .filter((count) => typeof count === 'number')
        return { sceneRenderer: recording.sceneRenderer, presentedTiles: Math.max(0, ...presented) }
      })
      return { pixels, submission }
    },

    async direct() {
      const probe = await page().evaluateHandle(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        const renderer = store.canvasRenderers.find((r) => r.tracksSceneSettlement)
        if (!renderer) throw new Error('Scene renderer unavailable')
        renderer.invalidateAllPictures()
        return { end: store.beginInteractiveEdit() }
      })
      try {
        await new CanvasHelper(page()).waitForRender()
        return await crop()
      } finally {
        await probe.evaluate((p) => p.end())
        await probe.dispose()
        await settle()
      }
    }
  }
}
