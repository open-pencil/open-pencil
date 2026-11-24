import type { CommunityDocument } from '#cloud/contract'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

import CommunityDocumentPage from './CommunityDocumentPage.vue'
import CommunityGalleryPage from './CommunityGalleryPage.vue'

/**
 * What a document says it is: its own description, else its newest named version's notes, else a
 * plain sentence.
 */
export function communityDocumentDescription(document: CommunityDocument): string {
  return (
    document.description ??
    document.versions.at(0)?.description ??
    `${document.name}, a file to open in OpenPencil and copy into your own workspace.`
  )
}

export type CommunityContent = {
  /** The gallery's documents, most recently changed first. */
  documents: CommunityDocument[]
  /** The document the page shows, or null on the gallery's own page. */
  document: CommunityDocument | null
  description: string
}

/**
 * What a community page shows, as HTML for crawlers that do not run its script: the gallery's
 * files, or one file. Vue's server renderer escapes every value it writes.
 */
export function communityContent({ documents, document, description }: CommunityContent) {
  return renderToString(
    document
      ? createSSRApp(CommunityDocumentPage, { document, description })
      : createSSRApp(CommunityGalleryPage, {
          description,
          entries: documents.map((entry) => ({
            document: entry,
            description: communityDocumentDescription(entry)
          }))
        })
  )
}
