import * as v from 'valibot'
import { parse as parseYAML } from 'yaml'

import { cleanupComments } from './upstream/comments'
import { cleanupText, encodeEntities, removeDirectives } from './upstream/preprocess'
import { matchFrontMatter } from './upstream/regexes'

/** Mermaid source as a diagram's grammar reads it, and the title its front matter gives. */
export interface PreparedSource {
  code: string
  title?: string
}

/** The front matter OpenPencil reads: the title, which YAML may give as a number or a flag. */
const frontMatterSchema = v.looseObject({
  title: v.optional(v.pipe(v.union([v.string(), v.number(), v.boolean()]), v.toString()))
})

function frontMatterTitle(body: string): string | undefined {
  try {
    const parsed = v.safeParse(frontMatterSchema, parseYAML(body))
    return parsed.success ? parsed.output.title : undefined
  } catch {
    return undefined
  }
}

/**
 * Prepares Mermaid source as Mermaid does before its grammar reads it (`preprocessDiagram`, then
 * `Diagram.fromText`), with the functions copied from the pinned release: line endings and HTML
 * attributes cleaned up, front matter, directives, and comments taken out, and `#name;` entities
 * hidden from the grammar, which reads `;` as a statement break.
 */
export function prepareSource(text: string): PreparedSource {
  let code = cleanupText(text)
  let title: string | undefined
  const frontMatter = matchFrontMatter(code)
  if (frontMatter) {
    // Mermaid dedents front matter by its fences' indent before reading it.
    const { indent } = frontMatter
    const body = indent
      ? frontMatter.body
          .split('\n')
          .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
          .join('\n')
      : frontMatter.body
    title = frontMatterTitle(body)
    code = code.slice(frontMatter.length)
  }
  return { code: `${encodeEntities(cleanupComments(removeDirectives(code)))}\n`, title }
}
