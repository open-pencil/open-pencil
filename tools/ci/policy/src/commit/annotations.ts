import { format } from '@commitlint/format'
import type { FormattableReport, FormatOptions } from '@commitlint/types'

const GUIDE = 'See CONTRIBUTING.md#commit-messages.'

/** Escapes a workflow command's message, which ends at a line break. */
function commandData(text: string): string {
  return text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
}

/**
 * GitHub error annotations for the messages commitlint rejected, one per message, naming its
 * first line and what is wrong with it.
 */
export function commitAnnotations(report: FormattableReport, prTitle: boolean): string[] {
  const title = prTitle ? 'PR title' : 'Commit messages'
  return (report.results ?? []).flatMap(({ input, errors = [] }) => {
    if (errors.length === 0) return []
    const header = input?.split('\n')[0] ?? ''
    const problems = errors.map((problem) => problem.message).join('; ')
    return [`::error title=${title}::${commandData(`${header}: ${problems}. ${GUIDE}`)}`]
  })
}

/**
 * commitlint's own report, followed in GitHub Actions by an annotation for each rejected message,
 * so the check's summary says what to fix without opening the log.
 */
export default function formatWithAnnotations(
  report: FormattableReport,
  options: FormatOptions
): string {
  const output = format(report, options)
  if (process.env.GITHUB_ACTIONS !== 'true') return output
  const annotations = commitAnnotations(report, process.env.COMMITLINT_PR_TITLE === '1')
  return [output, ...annotations].filter(Boolean).join('\n')
}
