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
    let exprs: string[]
    try {
      const parsed = JSON.parse(expr)
      exprs = Array.isArray(parsed) ? parsed : [expr]
    } catch {
      exprs = [expr]
    }

    if (exprs.length === 1) {
      return evalExpr(exprs[0])
    }

    return { results: exprs.map(evalExpr) }
  }
})
