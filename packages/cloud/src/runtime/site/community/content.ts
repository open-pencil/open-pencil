import {
  CLOUD_COMMUNITY_PATH,
  cloudCommunityPath,
  cloudCommunityPagePath,
  type CommunityDocument
} from '#cloud/contract'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

/** What a document says it is: its newest named version's notes, or else a plain sentence. */
export function communityDocumentDescription(document: CommunityDocument): string {
  return (
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

function documentPage(document: CommunityDocument, description: string) {
  return h('main', [
    h('h1', document.name),
    h('p', description),
    h('img', { src: document.thumbnailPath, alt: document.name }),
    h('p', [h('a', { href: cloudCommunityPath(document.id) }, 'Open in OpenPencil')]),
    document.versions.length > 0
      ? h('section', [
          h('h2', 'Versions'),
          h(
            'ul',
            document.versions.map((version) =>
              h('li', [
                h('time', { datetime: version.createdAt }, version.name),
                version.description ? h('p', version.description) : null
              ])
            )
          )
        ])
      : null,
    h('p', [h('a', { href: CLOUD_COMMUNITY_PATH }, 'All community files')])
  ])
}

function galleryPage(documents: CommunityDocument[], description: string) {
  return h('main', [
    h('h1', 'Community'),
    h('p', description),
    h(
      'ul',
      documents.map((document) =>
        h('li', [
          h('a', { href: cloudCommunityPagePath(document.id) }, [
            h('img', { src: document.thumbnailPath, alt: '', loading: 'lazy' }),
            h('h2', document.name)
          ]),
          h('p', communityDocumentDescription(document))
        ])
      )
    )
  ])
}

/**
 * What a community page shows, as plain HTML for crawlers that do not run its script: the gallery's
 * files with links to their pages, or one file with its preview, how to open it, and its named
 * versions. Vue's server renderer escapes every value it writes.
 */
export function communityContent({ documents, document, description }: CommunityContent) {
  const app = createSSRApp({
    render: () => (document ? documentPage(document, description) : galleryPage(documents, description))
  })
  return renderToString(app)
}
