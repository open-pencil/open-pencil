import { invoke } from '@tauri-apps/api/core'
import * as v from 'valibot'

import { HTML_IMPORT_VIEWPORT } from '@open-pencil/core/io/formats/html/layers'

import settleSource from '@/app/document/io/url/render/scripts/settle.ts?script'
import snapshotSource from '@/app/document/io/url/render/scripts/snapshot.ts?script'

const renderedPageSchema = v.object({ html: v.string(), url: v.string() })

/** A page as its scripts built it: its HTML, and the address it ended at. */
export type RenderedWebPage = v.InferOutput<typeof renderedPageSchema>

/**
 * A bundled script run in the page, followed by the value it gives back: its module's default
 * export, which the bundle leaves on the global the inline-script build names.
 */
function answering(source: string): string {
  return `${source}\n;openPencilInlineScript`
}

/** The scripts the desktop app runs in a page it renders, as the webview runs them. */
export const RENDER_SCRIPTS = {
  settle: answering(settleSource),
  snapshot: answering(snapshotSource)
}

/**
 * Tries to render a web page in a hidden desktop webview, where its scripts run and build it, as a
 * browser shows it, and reads back the document they built. Rejects when the page cannot be
 * rendered.
 */
export async function renderWebPage(url: string): Promise<RenderedWebPage> {
  const answer = await invoke<unknown>('render_web_page', {
    request: {
      url,
      width: HTML_IMPORT_VIEWPORT.width,
      height: HTML_IMPORT_VIEWPORT.height,
      settleScript: RENDER_SCRIPTS.settle,
      snapshotScript: RENDER_SCRIPTS.snapshot
    }
  })
  return v.parse(renderedPageSchema, answer)
}
