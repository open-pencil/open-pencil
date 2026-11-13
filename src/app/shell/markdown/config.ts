import attributes from '@comark/vue/plugins/attributes'
import components from '@comark/vue/plugins/components'
import linkify from '@comark/vue/plugins/linkify'
import security from '@comark/vue/plugins/security'
import taskList from '@comark/vue/plugins/task-list'
import { autoCloseMarkdown, createSerializedMarkdownParser, type ComarkPlugin } from 'comark'

import { IS_BROWSER } from '@open-pencil/core/constants'

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
 * Plain Markdown with task lists and inline components such as chat references. Raw HTML stays
 * text: Comark's `html`, frontmatter, and alert defaults are left out.
 */
const plugins: ComarkPlugin[] = [
  components(),
  attributes(),
  taskList(),
  linkify(),
  security(createMarkdownSecurityOptions(IS_BROWSER ? window.location.origin : 'http://localhost/'))
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

let highlighting: Promise<ComarkPlugin> | undefined

/** Shiki loads with the first renderer that highlights code, not with the app. */
function highlightPlugin(): Promise<ComarkPlugin> {
  highlighting ??= import('./highlight').then((module) => module.highlightPlugin)
  return highlighting
}

/** Parses one renderer's Markdown; calls finish in order, so a slow parse never lands last. */
export type MarkdownParser = ReturnType<typeof createSerializedMarkdownParser>

export async function createMarkdownParser(highlightCode: boolean): Promise<MarkdownParser> {
  return createSerializedMarkdownParser({
    registerDefaultPlugins: false,
    autoClose,
    plugins: highlightCode ? [...plugins, await highlightPlugin()] : plugins
  })
}
