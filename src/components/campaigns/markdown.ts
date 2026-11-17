import linkify from '@comark/vue/plugins/linkify'
import security from '@comark/vue/plugins/security'
import { createSerializedMarkdownParser, type MarkdownDocument } from 'comark'
import { defineComponent } from 'vue'

import { isCampaignLink } from '@open-pencil/feedback/contract'

/**
 * Markdown as a campaign's body may use it: emphasis, lists, and links, nothing else. The text
 * comes from a server, so unlike chat (`src/app/shell/markdown/config.ts`) it has no inline
 * components or attributes, raw HTML stays text, images keep no address, and links keep theirs
 * only over HTTPS; `CampaignMarkdownLink` then shows as a link only what `isCampaignLink` allows.
 */
let parser: ReturnType<typeof createSerializedMarkdownParser> | undefined

export function parseCampaignMarkdown(markdown: string): Promise<MarkdownDocument> {
  parser ??= createSerializedMarkdownParser({
    registerDefaultPlugins: false,
    plugins: [
      linkify(),
      security({
        allowedLinkPrefixes: ['https://'],
        allowedImagePrefixes: [],
        allowedProtocols: ['https'],
        allowDataImages: false
      })
    ]
  })
  return parser(markdown)
}

/** The address a campaign's link may open, or `undefined` to show its text alone. */
export function campaignLinkTarget(href: string | undefined): string | undefined {
  return href !== undefined && isCampaignLink(href) ? href : undefined
}

/** An image in a campaign's body draws nothing: campaign text never makes the app fetch. */
export const CampaignMarkdownImage = defineComponent({
  name: 'CampaignMarkdownImage',
  render: () => null
})
