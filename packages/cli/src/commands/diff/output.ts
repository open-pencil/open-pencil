import { bold, cyan, dim, green, ok, printError, red } from '#cli/format'

export interface DiffResult {
  diff?: string | null
  message?: string
  error?: string
}

function colorLine(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return bold(line)
  if (line.startsWith('@@')) return cyan(line)
  if (line.startsWith('+')) return green(line)
  if (line.startsWith('-')) return red(line)
  return dim(line)
}

/** Print a unified diff, colored on a terminal and raw when piped so it stays a valid patch. */
export function printUnifiedDiff(diff: string): void {
  if (!process.stdout.isTTY) {
    console.log(diff)
    return
  }
  console.log(diff.split('\n').map(colorLine).join('\n'))
}

export function printDiffResult(result: DiffResult, json: boolean): void {
  if (result.error) {
    printError(result.error)
    process.exit(1)
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (result.diff) printUnifiedDiff(result.diff)
  else console.log(ok(result.message ?? 'No differences found'))
}
