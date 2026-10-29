import { parse } from 'acorn'
import { transform } from 'sucrase'

const options = {
  transforms: ['typescript', 'jsx'] as Array<'typescript' | 'jsx'>,
  jsxPragma: '__h',
  jsxFragmentPragma: '__fragment',
  production: true
}

/**
 * Transformed Design JSX: a function body that returns what the source renders. Its elements
 * carry `__source: { lineNumber }` props; adding `lineOffset` to `lineNumber` gives the 1-based
 * line in the source that was passed in.
 */
export interface DesignJSXProgram {
  code: string
  lineOffset: number
}

const RULE = 'Design JSX is one JSX expression, or statements that end with `return` and the JSX'

function lineCount(text: string): number {
  let lines = 0
  for (const char of text) if (char === '\n') lines++
  return lines
}

function transformBody(body: string, withLines: boolean): string {
  return withLines
    ? transform(body, { ...options, production: false, filePath: 'design.jsx' }).code
    : transform(body, options).code
}

/** Whether a function body returns from its top level, as statements must end. */
function returns(code: string): boolean {
  const program = parse(code, { ecmaVersion: 'latest', allowReturnOutsideFunction: true })
  return program.body.some((statement) => statement.type === 'ReturnStatement')
}

/**
 * The function body a Design JSX string stands for, tried in order: one JSX expression, sibling
 * elements, or statements that end with `return` and the JSX, as a component's body does. Each
 * keeps the source's lines where they are.
 */
function transformProgram(source: string, withLines: boolean): DesignJSXProgram {
  const trimmed = source.trim()
  const lineOffset = lineCount(source.slice(0, source.length - source.trimStart().length))
  const expressions = [`return (${trimmed})`]
  if (trimmed.startsWith('<')) expressions.push(`return (<>${trimmed}</>)`)
  for (const body of expressions) {
    try {
      return { code: transformBody(body, withLines), lineOffset }
    } catch {
      continue
    }
  }
  let code: string
  try {
    code = transformBody(trimmed, withLines)
  } catch (error) {
    throw new Error(`${RULE}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error
    })
  }
  if (!returns(code)) throw new Error(`${RULE}; these statements return nothing.`)
  return { code, lineOffset }
}

/** Transform Design JSX into the body of a function that returns what it renders. */
export function transformDesignJSXExpression(source: string): string {
  return transformProgram(source, false).code
}

/** Like {@link transformDesignJSXExpression}, keeping the source line of every element. */
export function transformDesignJSXProgram(source: string): DesignJSXProgram {
  return transformProgram(source, true)
}
