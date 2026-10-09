import { DOMParser, type Document } from '@xmldom/xmldom'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

function parseXML(source: string): Document | null {
  try {
    return new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning') throw new Error(message)
      }
    }).parseFromString(source, 'image/svg+xml')
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

export function parseSVGFragment(source: string): Document | null {
  return parseXML(`<svg xmlns="${SVG_NAMESPACE}">${source.replace(XML_PROLOG, '')}</svg>`)
}
