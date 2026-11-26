import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'

import type { Editor } from '@open-pencil/core'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'

/** The pixels a filmstrip picture is across: twice its width in a wide panel. */
const THUMBNAIL_WIDTH = 480
/** How long a slide rests after a change before its picture is drawn again. */
const REST_MS = 250

/** Pictures of a deck's slides, each drawn again once the slide it shows rests after a change. */
export function useSlideThumbnails(editor: Editor): {
  urls: ShallowRef<ReadonlyMap<string, string>>
  want: (id: string, wanted: boolean) => void
} {
  const urls = shallowRef<ReadonlyMap<string, string>>(new Map())
  const wanted = new Set<string>()
  const stale = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined

  function setURL(id: string, url: string | null): void {
    const next = new Map(urls.value)
    const previous = next.get(id)
    if (previous) URL.revokeObjectURL(previous)
    if (url) next.set(id, url)
    else next.delete(id)
    urls.value = next
  }

  function schedule(delay: number): void {
    clearTimeout(timer)
    timer = setTimeout(drawNext, delay)
  }

  /** One slide a turn, so drawing a long deck never holds the page up. */
  function drawNext(): void {
    const id = [...stale].find((slide) => wanted.has(slide))
    if (id === undefined) return
    const { renderer, graph } = editor
    if (!renderer) {
      schedule(REST_MS)
      return
    }
    stale.delete(id)
    const slide = graph.getNode(id)
    const pageId = graph.pageOf(id)
    if (slide && pageId && slide.width > 0) {
      const image = renderNodesToImage(renderer.ck, renderer, graph, pageId, [id], {
        scale: THUMBNAIL_WIDTH / slide.width,
        format: 'PNG',
        useAbsoluteBounds: true
      })
      setURL(id, image ? URL.createObjectURL(new Blob([image], { type: 'image/png' })) : null)
    }
    schedule(0)
  }

  function markStale(id: string): void {
    const slide = editor.graph.closest(id, (node) => node.type === 'SLIDE')
    if (slide) stale.add(slide.id)
    if (slide) schedule(REST_MS)
  }

  function reset(): void {
    for (const url of urls.value.values()) URL.revokeObjectURL(url)
    urls.value = new Map()
    for (const id of wanted) stale.add(id)
    schedule(0)
  }

  const stops = [
    editor.onEditorEvent('node:created', (node) => markStale(node.id)),
    editor.onEditorEvent('node:updated', markStale),
    editor.onEditorEvent('node:reparented', (id, oldParentId) => {
      markStale(id)
      if (oldParentId) markStale(oldParentId)
    }),
    editor.onEditorEvent('node:reordered', markStale),
    editor.onEditorEvent('node:deleted', (id, parentId) => {
      if (urls.value.has(id)) setURL(id, null)
      if (parentId) markStale(parentId)
    }),
    editor.onEditorEvent('font:loaded', reset),
    editor.onEditorEvent('graph:replaced', reset)
  ]

  onScopeDispose(() => {
    clearTimeout(timer)
    for (const stop of stops) stop()
    for (const url of urls.value.values()) URL.revokeObjectURL(url)
  })

  return {
    urls,
    want(id, isWanted) {
      if (!isWanted) wanted.delete(id)
      else if (!wanted.has(id)) {
        wanted.add(id)
        if (!urls.value.has(id)) stale.add(id)
        schedule(0)
      }
    }
  }
}
