import { transform } from 'sucrase'

const options = {
  transforms: ['typescript', 'jsx'] as Array<'typescript' | 'jsx'>,
  jsxPragma: '__h',
  jsxFragmentPragma: '__fragment',
  production: true
}

function transformExpression(source: string): string {
  return transform(`return (${source.trim()})`, options).code
}

function statementBoundaries(source: string): number[] {
  const boundaries = new Set<number>()
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\n') boundaries.add(index + 1)
  }
  return [...boundaries].sort((left, right) => right - left)
}

/**
 * Transform Design JSX into a function body. A plain JSX expression is accepted directly.
 * For authored programs, top-level declarations must precede a final expression on a new line.
 */
export function transformDesignJSXExpression(source: string): string {
  const trimmed = source.trim()
  try {
    return transformExpression(trimmed)
  } catch (expressionError) {
    for (const boundary of statementBoundaries(trimmed)) {
      const statements = trimmed.slice(0, boundary).trim()
      const expression = trimmed.slice(boundary).trim()
      if (!statements || !expression) continue
      try {
        const transformedStatements = transform(statements, options).code
        return `${transformedStatements}\n${transformExpression(expression)}`
      } catch {
        continue
      }
    }
    throw expressionError
  }
}
