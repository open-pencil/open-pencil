import * as v from 'valibot'

import { CALC_FUNCTIONS, evaluateExpression } from './calc/expression'
import { defineTool } from './schema'

function evalExpr(
  expr: string
): { expr: string; result: number } | { expr: string; error: string } {
  try {
    const result = evaluateExpression(expr)
    if (!Number.isFinite(result)) {
      return { expr, error: `Produced ${String(result)}` }
    }
    return { expr, result }
  } catch (e) {
    return { expr, error: e instanceof Error ? e.message : String(e) }
  }
}

/** A JSON array of expressions; anything that is not a JSON array is one expression. */
const ExpressionListJSON = v.pipe(v.string(), v.parseJson(), v.array(v.string()))

export const calc = defineTool({
  name: 'calc',
  description:
    'Arithmetic calculator. ALWAYS use instead of mental math. ' +
    'Pass one expression or a JSON array of expressions — all evaluated in one call. ' +
    `Supports: + - * / % ** ( ) ${CALC_FUNCTIONS.join(' ')}. ` +
    'Examples: "844 - 56 - 96 - 82", \'["1440 * 8 / 12", "(952 - 16) / 2", "floor(390 * 0.6)"]\'',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.object({
    expr: v.pipe(v.string(), v.description('Single expression or JSON array of expressions'))
  }),
  execute: (_figma, { expr }) => {
    const parsed = v.safeParse(ExpressionListJSON, expr)
    // An issue with a path is a non-string array element; the rest mean "not a JSON array".
    if (!parsed.success && parsed.issues.some((issue) => issue.path !== undefined))
      return { expr, error: 'A JSON array of expressions must contain only strings' }
    const exprs = parsed.success ? parsed.output : [expr]

    if (exprs.length === 1) {
      return evalExpr(exprs[0])
    }

    return { results: exprs.map(evalExpr) }
  }
})
