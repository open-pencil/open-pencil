import { escapeAttribute } from 'entities'

import { cloudEmbedShareURL, parseCloudLinkPath } from '@open-pencil/cloud/contract'

/** How large an embed starts in the page around it, which its author can change. */
const EMBED_WIDTH = 800
const EMBED_HEIGHT = 450
/** A hairline around the frame, which pages of either theme show. */
const EMBED_STYLE = 'border: 1px solid #0000001a; border-radius: 8px'

/**
 * The frame another site puts in its page to show a document shared by link: the link's embed
 * address, its secret still in the fragment, or null for an address that is no shared link.
 */
export function cloudEmbedCode(linkURL: string, title: string): string | null {
  const url = new URL(linkURL)
  const path = parseCloudLinkPath(url.pathname)
  const secret = url.hash.slice(1)
  if (path?.kind !== 'share' || !secret) return null
  const source = cloudEmbedShareURL(url.origin, path.id, secret)
  return (
    `<iframe src="${escapeAttribute(source)}" title="${escapeAttribute(title)}"` +
    ` width="${EMBED_WIDTH}" height="${EMBED_HEIGHT}"` +
    ` style="${EMBED_STYLE}" allowfullscreen></iframe>`
  )
}
