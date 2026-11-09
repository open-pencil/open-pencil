import * as v from 'valibot'

import type { SceneNode } from '@open-pencil/scene-graph'
import {
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData,
  withPluginData
} from '@open-pencil/scene-graph/plugin-data'

/** What a page address this app accepts: an absolute http(s) address, never a scheme of its own. */
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * A page of the application a frame shows: the address the dev server answers on, the label the
 * layer tree names it by, and how the page stands to the canvas. The frame's own size is the
 * page's viewport, so a page is resized the way any other frame is.
 */
export const livePageSchema = v.object({
  url: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(2048)),
  label: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  mode: v.picklist(['live', 'snapshot'])
})
export type LivePage = v.InferOutput<typeof livePageSchema>

/**
 * What the application running in a page reports when an element is picked there: the file and
 * line the element is declared in, and the component around it.
 */
export const liveSelectionSchema = v.object({
  file: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(1024)),
  line: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  column: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  component: v.optional(v.pipe(v.string(), v.maxLength(200))),
  route: v.optional(v.pipe(v.string(), v.maxLength(2048)))
})
export type LiveSelection = v.InferOutput<typeof liveSelectionSchema>

/** Whether a node can show a page: only a frame has the size and clipping a page needs. */
export function canShowLivePage(node: SceneNode): boolean {
  return node.type === 'FRAME'
}

/** The page a frame shows, or null for a frame that draws its own layers. */
export function readLivePage(node: SceneNode): LivePage | null {
  return readPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.livePage) ?? null
}

/**
 * The plugin data that makes a frame show `page`, or that leaves it a plain frame for null. The
 * frame keeps every other entry, so comments, statuses, and export settings survive the change.
 */
export function pluginDataWithLivePage(node: SceneNode, page: LivePage | null) {
  return withPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.livePage, page ?? undefined)
}

/**
 * A page address as the address bar would take it: `localhost:3000` becomes `http://localhost:3000`,
 * and anything that is not an http(s) address answers empty, so a mistyped field never loads.
 */
export function normalizeLiveURL(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '') return ''
  let parsed: URL
  try {
    parsed = new URL(SCHEME.test(trimmed) ? trimmed : `http://${trimmed}`)
  } catch {
    return ''
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
  const bare = parsed.pathname === '/' && parsed.search === '' && parsed.hash === ''
  return bare ? parsed.origin : parsed.href
}
