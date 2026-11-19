import { parse, type DefaultTreeAdapterTypes } from 'parse5'

import { minOf } from '@open-pencil/std/arrays'

type ParsedNode = DefaultTreeAdapterTypes.Node

/** The `content` of a page's first `<meta http-equiv="refresh">`, wherever it sits. */
function refreshContent(node: ParsedNode): string | null {
  if ('tagName' in node && node.tagName === 'meta') {
    const attribute = (name: string) => node.attrs.find((attr) => attr.name === name)?.value
    if (attribute('http-equiv')?.trim().toLowerCase() === 'refresh')
      return attribute('content') ?? null
  }
  for (const child of 'childNodes' in node ? node.childNodes : []) {
    const found = refreshContent(child)
    if (found !== null) return found
  }
  return null
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
 * resolved against its address, as the HTML standard reads the value: a delay, then `;` or `,`
 * and the URL, optionally after `url=`. Null for a page that refreshes later, reloads itself, or
 * names no URL.
 */
export function immediateRefresh(html: string, baseURL: string): URL | null {
  const content = refreshContent(parse(html))?.trim()
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
  return target && URL.canParse(target, baseURL) ? new URL(target, baseURL) : null
}
