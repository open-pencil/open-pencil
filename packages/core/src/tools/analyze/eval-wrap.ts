const STATEMENT_START =
  /^(const |let |var |if |else |for |while |do |switch |try |catch |throw |return |async function |function |class |\{|\}|\/\/|\/\*)/

/**
 * Wrap eval code so the last bare expression is returned (REPL-style).
 *
 * - Already starts with `return` -> used verbatim
 * - Last non-empty line looks like a statement -> wrap everything in async IIFE
 * - Otherwise -> promote the last expression line to `return (expr)`
 */
export function wrapEvalCode(code: string): string {
  const trimmed = code.trim()
  if (trimmed.startsWith('return')) return trimmed

  const lines = trimmed.split('\n')
  let lastIdx = lines.length - 1
  while (lastIdx > 0 && !lines[lastIdx].trim()) lastIdx--
  const lastLine = lines[lastIdx].trim()

  if (lastLine && !STATEMENT_START.test(lastLine) && !lastLine.endsWith('}')) {
    const body = lines.slice(0, lastIdx).join('\n')
    return body ? `${body}\nreturn (${lastLine})` : `return (${lastLine})`
  }

  return `return (async () => { ${trimmed} })()`
}
