import { isAlias, isMap, isPair, isScalar, isSeq, parseDocument, visit } from 'yaml'

/** A step whose `run` holds more than one line of shell. */
export interface MultiLineRun {
  line: number
  lines: number
}

function lineAt(text: string, offset: number): number {
  let line = 1
  for (let index = 0; index < offset; index++) if (text[index] === '\n') line++
  return line
}

/**
 * The steps of a workflow or action whose `run` is more than one line. A folded scalar (`>-`) that
 * reads as one command line is one line; a literal block (`|`) of several commands is not.
 */
export function multiLineRuns(text: string): MultiLineRun[] {
  const document = parseDocument(text)
  const found: MultiLineRun[] = []
  visit(document, {
    Pair(_, pair, path) {
      if (!isScalar(pair.key) || pair.key.value !== 'run') return
      // An alias (`run: *script`) runs the text its anchor names.
      const node = isAlias(pair.value) ? pair.value.resolve(document) : pair.value
      if (!isScalar(node)) return
      // Only a step's own `run`: a mapping in the `steps` sequence, not an action input of that name.
      const [steps, sequence, step] = path.slice(-3)
      if (!isPair(steps) || !isScalar(steps.key) || steps.key.value !== 'steps') return
      if (!isSeq(sequence) || !isMap(step)) return
      if (typeof node.value !== 'string') return
      const lines = node.value.replace(/\n+$/, '').split('\n').length
      const range = isAlias(pair.value) ? pair.value.range : node.range
      if (lines > 1) found.push({ line: lineAt(text, range?.[0] ?? 0), lines })
    }
  })
  return found
}
