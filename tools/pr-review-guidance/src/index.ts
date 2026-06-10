import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const CODE_RABBIT_AUTHORS = new Set(['coderabbitai[bot]', 'coderabbitai'])
const REVIEW_GUIDANCE_PREFIXES = ['pr hygiene', 'pr readability', 'pr description']

export interface GitHubEvent {
  sender?: { login?: string }
  review?: { state?: string; body?: string }
  pull_request?: { number?: number }
  issue?: { number?: number; pull_request?: unknown }
  comment?: { body?: string }
}

export interface PullRequestSummary {
  state: string
  author_association: string
  title: string
  user: { login: string }
}

interface EventContext {
  issueNumber?: number
  shouldInspect: boolean
  text: string
}

interface GitHubActionsEnvironment {
  GITHUB_REPOSITORY_OWNER?: string
  GITHUB_REPOSITORY?: string
  GITHUB_EVENT_PATH?: string
  GITHUB_TOKEN?: string
  GITHUB_API_URL?: string
}

interface MonitorOptions {
  env?: GitHubActionsEnvironment
  fetchImpl?: typeof fetch
  log?: (message: string) => void
}

class GitHubAPIError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GitHubAPIError'
    this.status = status
  }
}

export function markdownTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export function normalizedCheckName(value: string): string {
  return value
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

export function reviewGuidanceCheckName(line: string): string | null {
  const [rawCheckName = '', status = ''] = markdownTableCells(line)
  const checkName = rawCheckName.replace(/^\[ignored\]\s*/i, '')
  const normalizedName = normalizedCheckName(checkName)
  const isRelevantCheck = REVIEW_GUIDANCE_PREFIXES.some((prefix) =>
    normalizedName.startsWith(prefix)
  )
  const needsMaintainerAttention = /❌/u.test(status) || /\berror\b/i.test(status)

  if (!isRelevantCheck || !needsMaintainerAttention) return null
  return checkName
}

export function reviewGuidanceChecks(text: string): string[] {
  return text.split('\n').flatMap((line) => {
    const name = reviewGuidanceCheckName(line)
    return name ? [name] : []
  })
}

export function eventContext(event: GitHubEvent): EventContext {
  if (event.review && event.pull_request) {
    return {
      issueNumber: event.pull_request.number,
      shouldInspect: event.review.state === 'changes_requested',
      text: `${event.review.state ?? ''}\n${event.review.body ?? ''}`
    }
  }

  if (event.comment && event.issue?.pull_request) {
    return {
      issueNumber: event.issue.number,
      shouldInspect: true,
      text: event.comment.body ?? ''
    }
  }

  return { shouldInspect: false, text: '' }
}

async function github<T>(
  apiURL: string,
  token: string,
  path: string,
  fetchImpl: typeof fetch,
  options: RequestInit = {}
): Promise<T | null> {
  const response = await fetchImpl(`${apiURL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers
    }
  })

  if (!response.ok) {
    const body = await response.text()
    throw new GitHubAPIError(
      `${options.method ?? 'GET'} ${path} failed: ${response.status} ${body}`,
      response.status
    )
  }

  if (response.status === 204) return null
  return response.json() as Promise<T>
}

function repositoryName(repository?: string): string | undefined {
  return repository?.split('/')[1]
}

function requiredEnvironment(env: GitHubActionsEnvironment) {
  const owner = env.GITHUB_REPOSITORY_OWNER
  const repo = repositoryName(env.GITHUB_REPOSITORY)
  const eventPath = env.GITHUB_EVENT_PATH
  const token = env.GITHUB_TOKEN
  const apiURL = env.GITHUB_API_URL ?? 'https://api.github.com'

  if (!owner || !repo || !eventPath || !token) {
    throw new Error('Missing required GitHub Actions environment')
  }

  return { apiURL, eventPath, owner, repo, token }
}

export async function monitorPRReviewGuidance(options: MonitorOptions = {}): Promise<void> {
  const env = requiredEnvironment(options.env ?? process.env)
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`))
  const fetchImpl = options.fetchImpl ?? fetch
  const event = JSON.parse(await readFile(env.eventPath, 'utf8')) as GitHubEvent
  const sender = event.sender?.login ?? ''

  if (!CODE_RABBIT_AUTHORS.has(sender)) {
    log(`No action needed: event sender is ${sender || 'unknown'}, not CodeRabbit.`)
    return
  }

  const context = eventContext(event)
  if (!context.issueNumber || !context.shouldInspect) {
    log('No PR review guidance signal found.')
    return
  }

  const checks = reviewGuidanceChecks(context.text)
  if (checks.length === 0) {
    log(
      'CodeRabbit did not report a PR description/readability check that needs maintainer attention.'
    )
    return
  }

  const pr = await github<PullRequestSummary>(
    env.apiURL,
    env.token,
    `/repos/${env.owner}/${env.repo}/pulls/${context.issueNumber}`,
    fetchImpl
  )
  if (!pr) throw new Error(`PR #${context.issueNumber} returned no data`)

  log(
    [
      `CodeRabbit review guidance noted on #${context.issueNumber}: ${checks.join(', ')}`,
      `Author: ${pr.user.login} (${pr.author_association})`,
      `Title: ${pr.title}`,
      'No automatic label, comment, or close was applied. This is only a maintainer review note.'
    ].join('\n')
  )
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectRun) {
  await monitorPRReviewGuidance()
}
