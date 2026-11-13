import {
  createSerializedMarkdownParser,
  INCOMPLETE_LINK_PLACEHOLDER,
  type ComarkPlugin
} from 'comark'
import attributes from 'comark/plugins/attributes'
import components from 'comark/plugins/components'
import linkify from 'comark/plugins/linkify'
import security from 'comark/plugins/security'
import taskList from 'comark/plugins/task-list'

import { IS_BROWSER } from '@open-pencil/core/constants'

/** The protocol of the link Comark writes while a link's address is still streaming in. */
export const PENDING_LINK_PROTOCOL = new URL(INCOMPLETE_LINK_PLACEHOLDER).protocol.slice(0, -1)

/**
 * What Markdown from a model or a person may link and embed: links to the web and mail, and
 * images only from the app's own origin, so text cannot make the app fetch from elsewhere.
 */
export function createMarkdownSecurityOptions(origin: string) {
  const appOrigin = new URL('/', origin).href

  return {
    allowedLinkPrefixes: ['*'],
    allowedImagePrefixes: [appOrigin],
    // A link still streaming in keeps Comark's placeholder; the link component shows it as text.
    allowedProtocols: ['http', 'https', 'mailto', PENDING_LINK_PROTOCOL],
    allowDataImages: false
  }
}

/**
 * Plain Markdown with task lists and inline components such as chat references. Raw HTML stays
 * text, and Comark's frontmatter, alerts, and other default plugins are left out.
 */
function basePlugins(): ComarkPlugin[] {
  const origin = IS_BROWSER ? window.location.origin : 'http://localhost/'
  return [
    components(),
    attributes(),
    taskList(),
    linkify(),
    security(createMarkdownSecurityOptions(origin))
  ]
}

let highlighting: Promise<ComarkPlugin> | undefined

/** Shiki and its grammars load with the first code-highlighting renderer, not with the app. */
function highlightPlugin(): Promise<ComarkPlugin> {
  highlighting ??= import('./highlight').then(({ highlightPlugin }) => highlightPlugin())
  return highlighting
}

/** Parses one renderer's Markdown; calls finish in order, so a slow parse never lands last. */
export type MarkdownParser = ReturnType<typeof createSerializedMarkdownParser>

export async function createMarkdownParser(highlightCode: boolean): Promise<MarkdownParser> {
  const plugins = basePlugins()
  if (highlightCode) plugins.push(await highlightPlugin())
  return createSerializedMarkdownParser({ registerDefaultPlugins: false, plugins })
}
