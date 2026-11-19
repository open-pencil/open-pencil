import { parse, type DefaultTreeAdapterTypes } from 'parse5'

import { minOf } from '@open-pencil/std/arrays'

type ParsedNode = DefaultTreeAdapterTypes.Node

type ParsedElement = DefaultTreeAdapterTypes.Element

/** The first element, in document order, that `matches`. */
function firstElement(
  node: ParsedNode,
  matches: (element: ParsedElement) => boolean
): ParsedElement | null {
  if ('tagName' in node && matches(node)) return node
  for (const child of 'childNodes' in node ? node.childNodes : []) {
    const found = firstElement(child, matches)
    if (found) return found
  }
  return null
}

function attribute(element: ParsedElement, name: string): string | undefined {
  return element.attrs.find((attr) => attr.name === name)?.value
}

/** Strips one pair of matching quotes, as the refresh value's URL may be written in. */
function unquoted(value: string): string {
  const first = value.at(0)
  if ((first === '"' || first === "'") && value.endsWith(first) && value.length > 1) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Where a page sends a browser at once with `<meta http-equiv="refresh" content="0; url=…">`,
 * resolved against its base address, as the HTML standard reads the value: a delay, then `;` or `,`
 * and the URL, optionally after `url=`. Null for a page that refreshes later, reloads itself, or
 * names no URL.
 */
export function immediateRefresh(html: string, baseURL: string): URL | null {
  const parsed = parse(html)
  const refresh = firstElement(
    parsed,
    (element) =>
      element.tagName === 'meta' &&
      attribute(element, 'http-equiv')?.trim().toLowerCase() === 'refresh'
  )
  const content = refresh && attribute(refresh, 'content')?.trim()
  if (!content) return null
  const first = minOf([content.indexOf(';'), content.indexOf(',')].filter((at) => at !== -1))
  const separator = Number.isFinite(first) ? first : -1
  const delay = Number.parseFloat(separator === -1 ? content : content.slice(0, separator))
  if (delay !== 0 || separator === -1) return null
  let target = content.slice(separator + 1).trim()
  if (target.toLowerCase().startsWith('url')) {
    const equals = target.indexOf('=')
    if (equals !== -1 && target.slice(3, equals).trim() === '')
      target = target.slice(equals + 1).trim()
  }
  target = unquoted(target)
  // Resolved as the page resolves its links: against its first `<base href>`, if it names one.
  const base = firstElement(
    parsed,
    (element) => element.tagName === 'base' && attribute(element, 'href') !== undefined
  )
  const baseHref = base && attribute(base, 'href')
  const documentBase =
    baseHref && URL.canParse(baseHref, baseURL) ? new URL(baseHref, baseURL) : baseURL
  return target && URL.canParse(target, documentBase) ? new URL(target, documentBase) : null
}
