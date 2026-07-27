import { DOMParser, type Document, type Element } from '@xmldom/xmldom'

export type ListedObject = {
  key: string
  lastModified: string | null
  size: number | null
}

export type ListObjectsPage = {
  objects: ListedObject[]
  isTruncated: boolean
  nextContinuationToken: string | null
}

function parseXML(source: string): Document | null {
  try {
    return new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning') throw new Error(message)
      }
    }).parseFromString(source, 'application/xml')
  } catch {
    return null
  }
}

function elementsByName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', name))
}

function firstText(root: Document | Element, name: string): string | null {
  return elementsByName(root, name)[0]?.textContent ?? null
}

export function parseS3ErrorXml(
  source: string,
  status: number
): { message: string; code: string | null } {
  const xmlDocument = parseXML(source)
  const code = xmlDocument ? firstText(xmlDocument, 'Code') : null
  const xmlMessage = xmlDocument ? firstText(xmlDocument, 'Message') : null
  const message =
    xmlMessage ??
    (source.trim() ? source.trim().slice(0, 200) : `S3 request failed with status ${status}`)
  return { message, code }
}

export function parseListObjectsV2Xml(source: string): ListedObject[] {
  return parseListObjectsV2Page(source).objects
}

export function parseListObjectsV2Page(source: string): ListObjectsPage {
  const xmlDocument = parseXML(source)
  if (!xmlDocument) {
    return { objects: [], isTruncated: false, nextContinuationToken: null }
  }

  const objects = elementsByName(xmlDocument, 'Contents').flatMap((content) => {
    const key = firstText(content, 'Key')
    if (!key) return []
    const sizeText = firstText(content, 'Size')
    const size = sizeText ? Number(sizeText) : null
    return [
      {
        key,
        lastModified: firstText(content, 'LastModified'),
        size: Number.isFinite(size) ? size : null
      }
    ]
  })
  return {
    objects,
    isTruncated: firstText(xmlDocument, 'IsTruncated')?.trim().toLowerCase() === 'true',
    nextContinuationToken: firstText(xmlDocument, 'NextContinuationToken')
  }
}
