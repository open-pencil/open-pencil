import { invoke } from '@tauri-apps/api/core'
import * as v from 'valibot'

/** What one pull request needs: where it lands, where it comes from, and what it says. */
export type PullRequestInput = {
  repo: string
  base: string
  head: string
  title: string
  body: string
}

/**
 * The arguments `gh pr create` takes, as a list no shell ever sees. The body travels as one
 * argument so a title or a line break in it can never become a second command.
 */
export function pullRequestArguments(input: PullRequestInput): string[] {
  return [
    'pr',
    'create',
    '--base',
    input.base,
    '--head',
    input.head,
    '--title',
    input.title,
    '--body',
    input.body
  ]
}

const programReportSchema = v.object({
  code: v.number(),
  stdout: v.string(),
  stderr: v.string()
})

/** The native command that runs an allow-listed program; injected so the flow is testable. */
export type ProgramTransport = (command: string, args?: Record<string, unknown>) => Promise<unknown>

/**
 * Open a pull request with the GitHub CLI and answer its address. A machine without `gh`, or one
 * where `gh` is not signed in, answers null: the caller then opens the browser's own compare
 * page instead, which needs no token at all.
 */
export async function createPullRequestViaGH(
  input: PullRequestInput,
  transport: ProgramTransport = invoke
): Promise<string | null> {
  let raw: unknown
  try {
    raw = await transport('run_program', {
      program: 'gh',
      args: pullRequestArguments(input),
      cwd: input.repo
    })
  } catch {
    return null
  }
  const report = v.safeParse(programReportSchema, raw)
  if (!report.success || report.output.code !== 0) return null
  return (
    report.output.stdout
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('https://')) ?? null
  )
}
