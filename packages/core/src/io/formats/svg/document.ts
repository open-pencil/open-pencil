import { DOMParser, type Document } from '@xmldom/xmldom'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

function parseXML(source: string): Document | null {
  // xmldom rejects a byte-order mark in front of the XML declaration.
  const markup = source.startsWith('\uFEFF') ? source.slice(1) : source
  try {
    return new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning') throw new Error(message)
      }
    }).parseFromString(markup, 'image/svg+xml')
  } catch {
    return null
  }
}

export function parseSVGDocument(source: string): Document | null {
  const xmlDocument = parseXML(source)
  return xmlDocument?.documentElement?.localName === 'svg' ? xmlDocument : null
}

/** An XML declaration or doctype, which is only valid at the start of a document. */
const XML_PROLOG = /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!DOCTYPE[^>[]*(?:\[[^\]]*\])?\s*>)?/i

/**
 * SVG markup, a whole `<svg>` or the shapes inside one, under a wrapper `<svg>`. The wrapper
 * declares `xlink` as the `<svg>` around an icon's body does, so `xlink:href` in the body parses.
 */
export function parseSVGFragment(source: string): Document | null {
  return parseXML(
    `<svg xmlns="${SVG_NAMESPACE}" xmlns:xlink="${XLINK_NAMESPACE}">${source.replace(XML_PROLOG, '')}</svg>`
  )
}
