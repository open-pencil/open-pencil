import type { HyperlinkTarget } from '@open-pencil/scene-graph'

/**
 * URLs Figma links to: web addresses with a host, in lower case and without surrounding space,
 * and mail and phone links. Measured in live Figma (2026-10-11).
 */
export const LINK_URL = /^(?:https?:\/\/[^\s/?#]+\S*|mailto:\S+|tel:\S+)$/

/** A host such as `openpencil.dev`, which a link typed without its scheme starts with. */
const BARE_HOST = /^[\w-]+(?:\.[\w-]+)+(?:[/?#]\S*)?$/
const BARE_EMAIL = /^[^\s@:/]+@[\w-]+(?:\.[\w-]+)+$/

/**
 * The link someone typed: a web, mail, or phone link, with `https://` or `mailto:` added to a
 * bare host or address; null for nothing, which removes a link; undefined for anything else.
 */
export function linkFromInput(input: string): HyperlinkTarget | null | undefined {
  const value = input.trim()
  if (!value) return null
  const url = withScheme(value)
  return LINK_URL.test(url) ? { type: 'URL', value: url } : undefined
}

/** `value` with the scheme a bare address or host leaves out. */
function withScheme(value: string): string {
  if (BARE_EMAIL.test(value)) return `mailto:${value}`
  if (BARE_HOST.test(value)) return `https://${value}`
  return value
}
