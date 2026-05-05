import type { EditorContext } from '#core/editor/types'
import { computeImageHash } from '#core/figma-api'
import type { Fill } from '#core/scene-graph'

const IMAGE_MAX_DIMENSION = 4096
const IMAGE_GAP = 20

export function createClipboardImageActions(ctx: EditorContext) {
  function storeImage(bytes: Uint8Array): string {
    const hash = computeImageHash(bytes)
    ctx.graph.images.set(hash, bytes)
    return hash
  }

  function decodeImageDimensions(bytes: Uint8Array): { w: number; h: number } | null {
    const ck = ctx.getCk()
    if (!ck) return null
    const skImg = ck.MakeImageFromEncoded(bytes)
    if (!skImg) return null
    let w = skImg.width()
    let h = skImg.height()
    skImg.delete()
    if (w > IMAGE_MAX_DIMENSION || h > IMAGE_MAX_DIMENSION) {
      const ratio = Math.min(IMAGE_MAX_DIMENSION / w, IMAGE_MAX_DIMENSION / h)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
    }
    return { w, h }
  }

  function placeImageNode(
    bytes: Uint8Array,
    x: number,
    y: number,
    w: number,
    h: number,
    name = 'Image'
  ): string | null {
    const hash = storeImage(bytes)
    const displayName = name.replace(/\.[^.]+$/, '')
    const pid = ctx.state.currentPageId
    const fill: Fill = {
      type: 'IMAGE',
      imageHash: hash,
      imageScaleMode: 'FILL',
      color: { r: 0, g: 0, b: 0, a: 0 },
      opacity: 1,
      visible: true
    }
    const node = ctx.graph.createNode('RECTANGLE', pid, {
      name: displayName,
      x,
      y,
      width: w,
      height: h,
      fills: [fill]
    })
    const id = node.id
    const snapshot = { ...node }
    ctx.undo.push({
      label: 'Place image',
      forward: () => {
        ctx.graph.images.set(hash, bytes)
        ctx.graph.createNode(snapshot.type, pid, snapshot)
      },
      inverse: () => {
        ctx.graph.deleteNode(id)
        ctx.graph.images.delete(hash)
        const next = new Set(ctx.state.selectedIds)
        next.delete(id)
        ctx.state.selectedIds = next
      }
    })
    return id
  }

  async function placeImageFiles(files: File[], cx: number, cy: number) {
    const prepared: Array<{ bytes: Uint8Array; name: string; w: number; h: number }> = []
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const dims = decodeImageDimensions(bytes)
      if (dims) prepared.push({ bytes, name: file.name, ...dims })
    }
    if (!prepared.length) return

    let totalW = 0
    for (const p of prepared) totalW += p.w
    totalW += IMAGE_GAP * (prepared.length - 1)
    const maxH = Math.max(...prepared.map((p) => p.h))

    let curX = cx - totalW / 2
    const topY = cy - maxH / 2
    const ids: string[] = []
    for (const p of prepared) {
      const id = placeImageNode(p.bytes, curX, topY, p.w, p.h, p.name)
      if (id) ids.push(id)
      curX += p.w + IMAGE_GAP
    }
    if (ids.length) {
      ctx.state.selectedIds = new Set(ids)
      ctx.requestRender()
    }
  }

  return { storeImage, placeImageFiles }
}
