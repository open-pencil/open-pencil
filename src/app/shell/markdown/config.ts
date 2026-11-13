import attributes from '@comark/vue/plugins/attributes'
import components from '@comark/vue/plugins/components'
import linkify from '@comark/vue/plugins/linkify'
import security from '@comark/vue/plugins/security'
import taskList from '@comark/vue/plugins/task-list'
import { autoCloseMarkdown, createSerializedMarkdownParser, type ComarkPlugin } from 'comark'

import { IS_BROWSER } from '@open-pencil/core/constants'

/** The origin rendered Markdown counts as the app's own. */
export const MARKDOWN_ORIGIN = IS_BROWSER ? window.location.origin : 'http://localhost/'

/**
 * What Markdown from a model or a person may link and embed: links to the web and mail, and
 * images only from the app's own origin, so text cannot make the app fetch from elsewhere.
 */
export function createMarkdownSecurityOptions(origin: string) {
  const appOrigin = new URL('/', origin).href

  return {
    allowedLinkPrefixes: ['*'],
    allowedImagePrefixes: [appOrigin],
    allowedProtocols: ['http', 'https', 'mailto'],
    allowDataImages: false
  }
}

/**
 * Whether an image may load from `src`: one from the app's own origin, never a data URL. The
 * image component checks it again on the rendered value, since Comark resolves a bound
 * `:src="props…"` after the security plugin has run.
 */
export function isAllowedImageSource(src: string, origin: string): boolean {
  const { allowedImagePrefixes } = createMarkdownSecurityOptions(origin)
  try {
    const url = new URL(src, origin)
    return (
      url.protocol !== 'data:' && allowedImagePrefixes.some((prefix) => url.href.startsWith(prefix))
    )
  } catch {
    return false
  }
}

/**
 * Plain Markdown with task lists and inline components such as chat references. Raw HTML stays
 * text: Comark's `html`, frontmatter, and alert defaults are left out.
 */
const plugins: ComarkPlugin[] = [
  components(),
  attributes(),
  taskList(),
  linkify(),
  security(createMarkdownSecurityOptions(MARKDOWN_ORIGIN))
]

/**
 * Comark's own auto-close for these plugins, with a link whose address is still streaming in
 * shown as its text: a partial address could not be opened, and a chat reference resolves only
 * once its address is whole.
 */
function autoClose(markdown: string, streaming?: boolean): string {
  return autoCloseMarkdown(markdown, {
    linkMode: 'text-only',
    syntax: true,
    attributes: true,
    dropTrailingOpeners: streaming === true
  })
}

let highlighting: Promise<ComarkPlugin | null> | undefined

/**
 * Shiki loads with the first renderer that highlights code, not with the app. When its chunk
 * fails to load, as offline, that renderer shows plain code and the next one tries again.
 */
function highlightPlugin(): Promise<ComarkPlugin | null> {
  highlighting ??= import('./highlight').then(
    (module) => module.highlightPlugin,
    (error: unknown) => {
      highlighting = undefined
      console.warn('[markdown] Code highlighting failed to load', error)
      return null
    }
  )
  return highlighting
}

/** Parses one renderer's Markdown; calls finish in order, so a slow parse never lands last. */
export type MarkdownParser = ReturnType<typeof createSerializedMarkdownParser>

export async function createMarkdownParser(highlightCode: boolean): Promise<MarkdownParser> {
  const highlight = highlightCode ? await highlightPlugin() : null
  return createSerializedMarkdownParser({
    registerDefaultPlugins: false,
    autoClose,
    plugins: highlight ? [...plugins, highlight] : plugins
  })
}
