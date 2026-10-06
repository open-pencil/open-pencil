import { transform } from 'sucrase'

const options = {
  transforms: ['typescript', 'jsx'] as Array<'typescript' | 'jsx'>,
  jsxPragma: '__h',
  jsxFragmentPragma: '__fragment',
  production: true
}

/** The part of an authored program a JSX element was written in. */
export type DesignJSXChunk = 'statements' | 'expression'

/**
 * Transformed Design JSX whose elements carry `__source: { fileName, lineNumber }` props.
 * `fileName` names the chunk; adding its offset to `lineNumber` gives the 1-based line in the
 * source that was passed in.
 */
export interface DesignJSXProgram {
  code: string
  lineOffsets: Readonly<Record<DesignJSXChunk, number>>
}

function lineCount(text: string): number {
  let lines = 0
  for (const char of text) if (char === '\n') lines++
  return lines
}

function transformChunk(source: string, chunk: DesignJSXChunk | null): string {
  if (!chunk) return transform(source, options).code
  const { code } = transform(source, { ...options, production: false, filePath: chunk })
  // Both chunks share one function body, and Sucrase declares `_jsxFileName` in each.
  return chunk === 'statements' ? code.replaceAll('_jsxFileName', '_jsxStatementsFileName') : code
}

function transformExpression(source: string, chunk: DesignJSXChunk | null): string {
  return transformChunk(`return (${source.trim()})`, chunk)
}

function statementBoundaries(source: string): number[] {
  const boundaries = new Set<number>()
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\n') boundaries.add(index + 1)
  }
  return [...boundaries].sort((left, right) => right - left)
}

function transformProgram(source: string, withLines: boolean): DesignJSXProgram {
  const leadingLines = lineCount(source.slice(0, source.length - source.trimStart().length))
  const trimmed = source.trim()
  try {
    return {
      code: transformExpression(trimmed, withLines ? 'expression' : null),
      lineOffsets: { statements: leadingLines, expression: leadingLines }
    }
  } catch (expressionError) {
    for (const boundary of statementBoundaries(trimmed)) {
      const statements = trimmed.slice(0, boundary).trim()
      const rawExpression = trimmed.slice(boundary)
      const expression = rawExpression.trim()
      if (!statements || !expression) continue
      try {
        const transformedStatements = transformChunk(statements, withLines ? 'statements' : null)
        const expressionStart = boundary + rawExpression.length - rawExpression.trimStart().length
        return {
          code: `${transformedStatements}\n${transformExpression(expression, withLines ? 'expression' : null)}`,
          lineOffsets: {
            statements: leadingLines,
            expression: leadingLines + lineCount(trimmed.slice(0, expressionStart))
          }
        }
      } catch {
        continue
      }
    }
    throw expressionError
  }
}

/**
 * Transform Design JSX into a function body. A plain JSX expression is accepted directly.
 * For authored programs, top-level declarations must precede a final expression on a new line.
 */
export function transformDesignJSXExpression(source: string): string {
  return transformProgram(source, false).code
}

/** Like {@link transformDesignJSXExpression}, keeping the source line of every element. */
export function transformDesignJSXProgram(source: string): DesignJSXProgram {
  return transformProgram(source, true)
}
