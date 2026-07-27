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

export function parseSVGFragment(source: string): Document | null {
  return parseXML(`<svg xmlns="${SVG_NAMESPACE}">${source}</svg>`)
}
