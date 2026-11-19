import jison from 'jison'

import { provenance, type Grammar } from './sources'

/**
 * A JISON grammar as an ES module exporting its parser, built with the options Mermaid's build
 * uses (`.build/jisonTransformer.ts`), under a header naming where it came from.
 */
export function parserModule(grammar: Grammar, source: string): string {
  const generator = new jison.Generator(source, { moduleType: 'js', 'token-stack': true })
  const parser = generator.generate({ moduleMain: '() => {}' })
  return [
    '// @ts-nocheck',
    provenance([grammar.source], 'Generated'),
    parser,
    'parser.parser = parser',
    'export default parser',
    ''
  ].join('\n')
}
