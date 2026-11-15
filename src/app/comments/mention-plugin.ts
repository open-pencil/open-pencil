import { defineComarkPlugin, type ElementNode } from 'comark'
import { visit } from 'comark/utils'

import { mentionedAccount } from './mentions'

/** The inline component a mention renders as; the comment renderer registers it. */
export const COMMENT_MENTION = 'comment-mention'

/**
 * Turns each mention link of a comment into the `comment-mention` element, which keeps the link's
 * text and names the account. It runs before the security plugin, which would drop the
 * `openpencil:` address, and every other link stays a link.
 */
export const mentionPlugin = defineComarkPlugin(() => ({
  name: 'comment-mentions',
  post(state) {
    visit(
      state.tree,
      (node) => Array.isArray(node) && node[0] === 'a',
      (node) => {
        const [, attributes, ...children] = node as ElementNode
        const href = attributes.href
        const account = typeof href === 'string' ? mentionedAccount(href) : null
        if (!account) return undefined
        const mention: ElementNode = [COMMENT_MENTION, { target: account }, ...children]
        return mention
      }
    )
  }
}))
