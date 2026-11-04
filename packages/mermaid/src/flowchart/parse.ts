import { prepareSource } from '../source'
import flowParser from '../upstream/flow.js'
import { FlowchartBuilder } from './builder'
import type { Flowchart } from './model'

/**
 * A Mermaid flowchart (`flowchart …` or `graph …`) read into its model. Throws Mermaid's parse
 * error, which names the line and what was expected, when the text is not a flowchart.
 */
export function parseFlowchart(text: string): Flowchart {
  const { code, title } = prepareSource(text)
  const builder = new FlowchartBuilder()
  // The grammar keeps its state in `yy` and its own lexer, so each parse gets a fresh copy.
  const parser = Object.create(flowParser) as typeof flowParser
  parser.yy = builder.grammarCalls()
  // Mermaid drops spaces after a closing brace at a line's end, which its grammar trips over.
  parser.parse(code.replace(/}\s*\n/g, '}\n'))
  return builder.result(title)
}
