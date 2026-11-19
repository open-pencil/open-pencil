import { invoke } from '@tauri-apps/api/core'
import * as v from 'valibot'

import { HTML_IMPORT_VIEWPORT } from '@open-pencil/core/io/formats/html/layers'

import { pageScript, pageSettling, pageSnapshot } from './scripts'

const renderedPageSchema = v.object({ html: v.string(), url: v.string() })

/** A page as its scripts built it: its HTML, and the address it ended at. */
export type RenderedWebPage = v.InferOutput<typeof renderedPageSchema>

/**
 * Renders a web page in a hidden desktop webview, where its scripts run and build it, as a browser
 * shows it, and reads back the document they built. Rejects when the page cannot be rendered.
 */
export async function renderWebPage(url: string): Promise<RenderedWebPage> {
  const answer = await invoke<unknown>('render_web_page', {
    request: {
      url,
      width: HTML_IMPORT_VIEWPORT.width,
      height: HTML_IMPORT_VIEWPORT.height,
      settleScript: pageScript(pageSettling),
      snapshotScript: pageScript(pageSnapshot)
    }
  })
  return v.parse(renderedPageSchema, answer)
}
