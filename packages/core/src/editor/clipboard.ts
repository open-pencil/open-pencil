import { buildFigmaClipboardHTML, importClipboardNodes, parseFigmaClipboard } from '../clipboard'
import { selectionToJSX } from '../design-jsx'
import { computeImageHash } from '../figma-api'
import { computeBounds } from '../geometry'
import { renderNodesToSVG } from '../io/formats/svg'
import { computeAllLayouts } from '../layout'
import { collectFontKeys } from '../text/fonts'

import type { Fill, SceneGraph, SceneNode } from '../scene-graph'
import type { Vector } from '../types'
import type { EditorContext } from './types'

export function createClipboardActions(ctx: EditorContext) {
  function collectSubtrees(g: SceneGraph, rootIds: string[]): SceneNode[] {
    const result: SceneNode[] = []
    function walk(id: string) {
      const node = g.getNode(id)
      if (!node) return
      result.push({ ...node })
      for (const childId of node.childIds) walk(childId)
    }
    for (const id of rootIds) walk(id)
    return result
  }

  function centerNodesAt(nodeIds: string[], cx: number, cy: number) {
    const items = nodeIds.map((id) => ctx.graph.getNode(id)).filter((n) => n != null)
    const b = computeBounds(items)
    if (b.width === 0 && b.height === 0 && items.length === 0) return
    const dx = cx - (b.x + b.width / 2)
    const dy = cy - (b.y + b.height / 2)
    for (const id of nodeIds) {
      const n = ctx.graph.getNode(id)
      if (n) ctx.graph.updateNode(id, { x: n.x + dx, y: n.y + dy })
    }
  }

  async function loadFontsForNodes(nodeIds: string[]) {
    const toLoad = collectFontKeys(ctx.graph, nodeIds)
    if (toLoad.length === 0) return []

    const results = await Promise.all(toLoad.map(([family, style]) => ctx.loadFont(family, style)))
    const failed = toLoad.filter((_, i) => results[i] === null)
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    return failed
  }

  function duplicateSelected(selectedNodes: SceneNode[]) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const selectedSet = new Set(selectedNodes.map((n) => n.id))
    const topLevel = selectedNodes.filter((n) => !n.parentId || !selectedSet.has(n.parentId))

    const newRootIds: string[] = []
    const rootSnapshots: SceneNode[] = []

    for (const node of topLevel) {
      const parentId = node.parentId ?? ctx.state.currentPageId
      const clone = ctx.graph.cloneTree(node.id, parentId, {
        name: node.name + ' copy',
        x: node.x + 20,
        y: node.y + 20
      })
      if (!clone) continue
      newRootIds.push(clone.id)
      const snapshot = ctx.graph.getNode(clone.id)
      if (snapshot) rootSnapshots.push(structuredClone(snapshot))
    }

    const cloneSnapshotTree = (snapshot: SceneNode): SceneNode => {
      const cloned = structuredClone(snapshot)
      cloned.childIds = snapshot.childIds
        .map((childId) => ctx.graph.getNode(childId))
        .filter((child): child is SceneNode => child != null)
        .map((child) => cloneSnapshotTree(child))
        .map((child) => child.id)
      return cloned
    }

    for (let i = 0; i < rootSnapshots.length; i++) {
      rootSnapshots[i] = cloneSnapshotTree(rootSnapshots[i])
    }

    const snapshotIndex = new Map<string, SceneNode>()
    for (const snapshot of rootSnapshots) {
      snapshotIndex.set(snapshot.id, snapshot)
    }

    const restoreTree = (snapshot: SceneNode, parentId: string) => {
      const { id: _snapshotId, parentId: _snapshotParentId, childIds, ...rest } = snapshot
      const created = ctx.graph.createNode(snapshot.type, parentId, rest)
      for (const childId of childIds) {
        const child = snapshotIndex.get(childId)
        if (!child) continue
        restoreTree(child, created.id)
      }
      return created.id
    }

    if (newRootIds.length > 0) {
      ctx.state.selectedIds = new Set(newRootIds)
      ctx.undo.push({
        label: 'Duplicate',
        forward: () => {
          const restoredRootIds: string[] = []
          for (const snapshot of rootSnapshots) {
            const parentId = snapshot.parentId ?? ctx.state.currentPageId
            restoredRootIds.push(restoreTree(snapshot, parentId))
          }
          ctx.state.selectedIds = new Set(restoredRootIds)
        },
        inverse: () => {
          for (const id of [...ctx.state.selectedIds].reverse()) ctx.graph.deleteNode(id)
          ctx.state.selectedIds = prevSelection
        }
      })
    }
  }

  async function writeCopyData(clipboardData: DataTransfer, selectedNodes: SceneNode[]) {
    if (selectedNodes.length === 0) return

    const names = selectedNodes.map((n) => n.name).join('\n')
    const html = await buildFigmaClipboardHTML(selectedNodes, ctx.graph)
    if (html) clipboardData.setData('text/html', html)
    clipboardData.setData('text/plain', names)
  }

  function pasteFromHTML(html: string, cursorPos?: Vector) {
    void parseFigmaClipboard(html).then((figma) => {
      if (figma) {
        const prevSelection = new Set(ctx.state.selectedIds)
        const created = importClipboardNodes(
          figma.nodes,
          ctx.graph,
          ctx.state.currentPageId,
          0,
          0,
          figma.blobs
        )
        if (created.length > 0) {
          const { width: viewW, height: viewH } = ctx.getViewportSize()
          const cx = cursorPos?.x ?? (-ctx.state.panX + viewW / 2) / ctx.state.zoom
          const cy = cursorPos?.y ?? (-ctx.state.panY + viewH / 2) / ctx.state.zoom
          centerNodesAt(created, cx, cy)
          computeAllLayouts(ctx.graph, ctx.state.currentPageId)
          ctx.state.selectedIds = new Set(created)

          const allNodes = collectSubtrees(ctx.graph, created)
          const pageId = ctx.state.currentPageId
          ctx.undo.push({
            label: 'Paste',
            forward: () => {
              for (const snapshot of allNodes) {
                ctx.graph.createNode(snapshot.type, snapshot.parentId ?? pageId, {
                  ...snapshot,
                  childIds: []
                })
              }
              computeAllLayouts(ctx.graph, pageId)
              ctx.state.selectedIds = new Set(created)
            },
            inverse: () => {
              for (const id of [...created].reverse()) ctx.graph.deleteNode(id)
              computeAllLayouts(ctx.graph, pageId)
              ctx.state.selectedIds = prevSelection
            }
          })
          void loadFontsForNodes(created)
          warnMissingImages(created)
        }
      }
    })
  }

  function warnMissingImages(nodeIds: string[]) {
    const allNodes = collectSubtrees(ctx.graph, nodeIds)
    return allNodes.some((n) =>
      n.fills.some((f) => f.type === 'IMAGE' && f.imageHash && !ctx.graph.images.has(f.imageHash))
    )
  }

  function deleteSelected() {
    const entries: Array<{ id: string; parentId: string; snapshot: SceneNode; index: number }> = []
    for (const id of ctx.state.selectedIds) {
      const node = ctx.graph.getNode(id)
      if (!node || node.locked) continue
      const parentId = node.parentId ?? ctx.state.currentPageId
      const parent = ctx.graph.getNode(parentId)
      const index = parent?.childIds.indexOf(id) ?? -1
      entries.push({ id, parentId, snapshot: { ...node }, index })
    }
    if (entries.length === 0) return

    const prevSelection = new Set(ctx.state.selectedIds)
    for (const { id } of entries) ctx.graph.deleteNode(id)

    ctx.undo.push({
      label: 'Delete',
      forward: () => {
        for (const { id } of entries) ctx.graph.deleteNode(id)
        ctx.state.selectedIds = new Set()
      },
      inverse: () => {
        for (const { snapshot, parentId, index } of [...entries].reverse()) {
          ctx.graph.createNode(snapshot.type, parentId, snapshot)
          if (index >= 0) {
            ctx.graph.reorderChild(snapshot.id, parentId, index)
          }
        }
        ctx.state.selectedIds = prevSelection
      }
    })
    ctx.state.selectedIds = new Set()
  }

  function storeImage(bytes: Uint8Array): string {
    const hash = computeImageHash(bytes)
    ctx.graph.images.set(hash, bytes)
    return hash
  }

  const IMAGE_MAX_DIMENSION = 4096
  const IMAGE_GAP = 20

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

  function copySelectionAsText(ids: string[]): string {
    return ids.map((id) => ctx.graph.getNode(id)?.name ?? id).join('\n')
  }

  function copySelectionAsSVG(ids: string[]): string | null {
    const nodeIds =
      ids.length > 0 ? ids : ctx.graph.getChildren(ctx.state.currentPageId).map((n) => n.id)
    return renderNodesToSVG(ctx.graph, ctx.state.currentPageId, nodeIds)
  }

  function copySelectionAsJSX(ids: string[]): string | null {
    return ids.length > 0 ? selectionToJSX(ids, ctx.graph) : null
  }

  return {
    collectSubtrees,
    centerNodesAt,
    loadFontsForNodes,
    duplicateSelected,
    writeCopyData,
    pasteFromHTML,
    warnMissingImages,
    deleteSelected,
    storeImage,
    placeImageFiles,
    copySelectionAsText,
    copySelectionAsSVG,
    copySelectionAsJSX
  }
}
