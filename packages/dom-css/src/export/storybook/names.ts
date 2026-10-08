import { pascalCase } from 'es-toolkit/string'

/**
 * Claim `base`, or the first free `base<separator><n>` from 2 on. `key` decides which
 * names collide, e.g. ignoring case for file names on case-insensitive file systems.
 */
export function claimName(
  base: string,
  taken: Set<string>,
  { separator = '', key = (name: string) => name } = {}
): string {
  let name = base
  for (let n = 2; taken.has(key(name)); n++) name = `${base}${separator}${n}`
  taken.add(key(name))
  return name
}

const NOT_IDENTIFIER_PART = /[^\p{ID_Continue}]/gu
const IDENTIFIER_START = /^\p{ID_Start}/u

/** A PascalCase JavaScript identifier for `text`, prefixed with `fallback` when it cannot start one. */
export function identifierName(text: string, fallback: string): string {
  const name = pascalCase(text).replace(NOT_IDENTIFIER_PART, '')
  return IDENTIFIER_START.test(name) ? name : `${fallback}${name}`
}

/**
 * Storybook's `sanitize` from `src/csf/csf-utils.ts`, which turns titles into story ids.
 * It is only exported from `storybook/internal/csf`, so it is copied here; a test keeps
 * the copy equal to the installed Storybook.
 */
export function storyId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}
