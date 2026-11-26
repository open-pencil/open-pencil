import { invoke } from '@tauri-apps/api/core'
import * as v from 'valibot'

import type { DesignViewport } from '@open-pencil/dom-css'
import { randomHex } from '@open-pencil/std/random'

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
 * Tries to render a web page in a hidden desktop webview of `viewport`'s size, where its scripts
 * run and build it, as a browser shows it, and reads back the document they built. Rejects when
 * the page cannot be rendered, and when `signal` aborts, which closes the page at once.
 */
export async function renderWebPage(
  url: string,
  viewport: DesignViewport,
  signal?: AbortSignal
): Promise<RenderedWebPage> {
  signal?.throwIfAborted()
  const id = randomHex(16)
  const cancel = () => void invoke('cancel_web_page_render', { id }).catch(() => undefined)
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    const answer = await invoke<unknown>('render_web_page', {
      request: {
        id,
        url,
        width: viewport.width,
        height: viewport.height,
        settleScript: RENDER_SCRIPTS.settle,
        snapshotScript: RENDER_SCRIPTS.snapshot
      }
    })
    signal?.throwIfAborted()
    return v.parse(renderedPageSchema, answer)
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}
