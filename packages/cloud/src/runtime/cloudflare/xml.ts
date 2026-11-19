import { DOMParser, Node } from '@xmldom/xmldom'

/**
 * Gives the AWS SDK the XML parser it reads S3's answers with. Wrangler bundles the SDK's browser
 * build, which parses XML with the browser's `DOMParser` and `Node`; workerd has neither, so every
 * S3 error would surface as a `ReferenceError` instead of its code. A runtime that has a
 * `DOMParser` keeps its own.
 */
export function provideXMLParser(): void {
  if ('DOMParser' in globalThis) return
  Object.assign(globalThis, { DOMParser, Node })
}
