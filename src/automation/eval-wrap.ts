const STATEMENT_KEYWORDS =
  /^(const|let|var|function|class|if|for|while|do|switch|try|throw|return|break|continue|import|export|async\s+function|\/\/|\/\*)/

/**
 * Wrap eval code so the last bare expression is returned (REPL-style).
 *
 * - Already starts with `return` → used verbatim
 * - Last non-empty line looks like a statement keyword → wrap in IIFE so we
 *   can still await async side-effects
 * - Otherwise → split off the last line and promote it to `return (lastLine)`
 */
export function wrapEvalCode(code: string): string {
  const trimmed = code.trim()
  if (trimmed.startsWith('return')) return trimmed

  const lines = trimmed.split('\n')
  const lastLine = lines.findLast((l) => l.trim().length > 0) ?? ''
  const lastTrimmed = lastLine.trim()

  const isStatement =
    STATEMENT_KEYWORDS.test(lastTrimmed) ||
    lastTrimmed.endsWith('{') ||
    lastTrimmed.endsWith('}') ||
    lastTrimmed.endsWith(';')

  if (!isStatement) {
    const body = lines.slice(0, lines.lastIndexOf(lastLine)).join('\n')
    return body ? `${body}\nreturn (${lastTrimmed})` : `return (${lastTrimmed})`
  }

  return `return (async () => { ${trimmed} })()`
}
