/**
 * The Mermaid sources `@open-pencil/mermaid` runs, taken from one pinned Mermaid release and
 * committed under `packages/mermaid/src/upstream`, so building and testing never need the network.
 *
 * Mermaid parses flowcharts with a JISON grammar whose parser calls methods on a `yy` object;
 * Mermaid's `FlowDB` fills its renderer's state there, and `@open-pencil/mermaid` supplies its
 * own object that builds a typed model instead. The grammar is not in Mermaid's npm package, so
 * it is downloaded from the release's commit and built as Mermaid's build builds it. The text
 * preparation Mermaid runs before a grammar sees the text (front matter, directives, comments,
 * and `#name;` entities) is copied as Mermaid wrote it.
 *
 * When Mermaid switches flowcharts to its new parser: Mermaid is moving each diagram from JISON
 * and Langium to a Chevrotain lexer, parser, and visitor kept beside the diagram
 * (mermaid-js/mermaid#7855, pie charts first). Once flowcharts have one, copy those TypeScript
 * files here instead of `flow.jison`, add the `chevrotain` runtime to `@open-pencil/mermaid`,
 * and adapt `packages/mermaid/src/flowchart/builder.ts` to what the visitor produces; the model
 * and everything that reads it stay as they are.
 */
export const MERMAID_RELEASE = {
  tag: 'mermaid@12.2.0',
  commit: '1fb7869866dd619168d840291c9c54b4f129758b'
}

/** Where the copied sources, the parsers built from them, and Mermaid's licence go. */
export const UPSTREAM_DIR = 'packages/mermaid/src/upstream'

export interface Grammar {
  /** The parser's file name in the upstream folder. */
  parser: string
  /** The grammar's path in Mermaid's repository. */
  source: string
}

export const GRAMMARS: Grammar[] = [
  { parser: 'flow', source: 'packages/mermaid/src/diagrams/flowchart/parser/flow.jison' }
]

/** A Mermaid module copied whole, which works only while it imports nothing. */
export interface CopiedModule {
  file: string
  source: string
}

export const COPIED_MODULES: CopiedModule[] = [
  { file: 'regexes.ts', source: 'packages/mermaid/src/diagram-api/regexes.ts' },
  { file: 'comments.ts', source: 'packages/mermaid/src/diagram-api/comments.ts' }
]

/**
 * Declarations copied out of Mermaid modules that hold too much else to take whole, into one
 * module of their own, which imports what they use from the copied modules.
 */
export const EXTRACTED_MODULE = {
  file: 'preprocess.ts',
  imports: ["import { directiveRegex } from './regexes'"],
  declarations: [
    { source: 'packages/mermaid/src/preprocess.ts', names: ['cleanupText'] },
    {
      source: 'packages/mermaid/src/utils.ts',
      names: ['removeDirectives', 'encodeEntities', 'decodeEntities']
    }
  ]
}

/**
 * Mermaid sources `@open-pencil/mermaid` follows by hand rather than copies: what the grammar's
 * calls mean (`FlowDB`) and the shape names. `--check` shows how a newer release changes them.
 */
export const FOLLOWED_SOURCES = [
  'packages/mermaid/src/diagrams/flowchart/flowDb.ts',
  'packages/mermaid/src/rendering-util/rendering-elements/shapes.ts'
]

export function sourceURL(path: string, commit = MERMAID_RELEASE.commit): string {
  return `https://raw.githubusercontent.com/mermaid-js/mermaid/${commit}/${path}`
}

/** The header a copied or generated file starts with, naming where it came from. */
export function provenance(sources: string[], how: string): string {
  return [
    `// ${how} by \`bun run generate:mermaid-sources\` from ${MERMAID_RELEASE.tag}`,
    ...sources.map((source) => `// (${sourceURL(source)})`),
    '// Copyright (c) 2014 - 2022 Knut Sveidqvist. MIT License; see MERMAID-LICENSE.txt.',
    '// Do not edit: change the pinned release in tools/generate/mermaid-sources and regenerate.'
  ].join('\n')
}
