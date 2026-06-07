import { readFile } from 'node:fs/promises'

const owner = process.env.GITHUB_REPOSITORY_OWNER
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const eventPath = process.env.GITHUB_EVENT_PATH
const token = process.env.GITHUB_TOKEN
const githubAPIURL = process.env.GITHUB_API_URL ?? 'https://api.github.com'

if (!owner || !repo || !eventPath || !token) {
  throw new Error('Missing required GitHub Actions environment')
}

interface GitHubEvent {
  sender?: { login?: string }
  review?: { state?: string; body?: string }
  pull_request?: { number?: number }
  issue?: { number?: number; pull_request?: unknown }
  comment?: { body?: string }
}

interface PullRequestResponse {
  state: string
  author_association: string
}

class GitHubAPIError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const event = JSON.parse(await readFile(eventPath, 'utf8')) as GitHubEvent
const sender = event.sender?.login ?? ''
const coderabbitAuthors = new Set(['coderabbitai[bot]', 'coderabbitai'])

if (!coderabbitAuthors.has(sender)) {
  console.log(`Ignoring sender: ${sender}`)
  process.exit(0)
}

let issueNumber: number | undefined
let text = ''
let shouldInspect = false

if (event.review && event.pull_request) {
  issueNumber = event.pull_request.number
  text = `${event.review.state ?? ''}\n${event.review.body ?? ''}`
  shouldInspect = event.review.state === 'changes_requested'
} else if (event.comment && event.issue?.pull_request) {
  issueNumber = event.issue.number
  text = event.comment.body ?? ''
  shouldInspect = true
}

if (!issueNumber || !shouldInspect) {
  console.log('No actionable PR hygiene signal found.')
  process.exit(0)
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function normalizedCheckName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()
}

function isPRHygieneFailure(line: string): boolean {
  const cells = tableCells(line)
  const checkName = cells[0] ?? ''
  const status = cells[1] ?? ''
  if (checkName.toLowerCase().includes('[ignored]')) return false
  if (!normalizedCheckName(checkName).startsWith('pr hygiene')) return false

  return /❌/u.test(status) || /\berror\b/i.test(status)
}

const hygieneFailed = text.split('\n').some(isPRHygieneFailure)

if (hygieneFailed) {
  console.log('Detected failed PR Hygiene check from CodeRabbit pre-merge table.')
}

if (!hygieneFailed) {
  console.log('CodeRabbit signal did not reference a failed PR Hygiene check.')
  process.exit(0)
}

async function github<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  const response = await fetch(`${githubAPIURL}${path}`, {
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
    throw new GitHubAPIError(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${body}`, response.status)
  }

  if (response.status === 204) return null
  return response.json() as Promise<T>
}

const pr = await github<PullRequestResponse>(`/repos/${owner}/${repo}/pulls/${issueNumber}`)
if (!pr) throw new Error(`PR #${issueNumber} returned no data`)

const trustedAssociations = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

if (trustedAssociations.has(pr.author_association)) {
  console.log(`Not closing trusted author association: ${pr.author_association}`)
  process.exit(0)
}

if (pr.state !== 'open') {
  console.log(`PR is already ${pr.state}.`)
  process.exit(0)
}

const label = 'invalid'
try {
  await github<unknown>(`/repos/${owner}/${repo}/labels/${encodeURIComponent(label)}`)
} catch (error) {
  if (!(error instanceof GitHubAPIError) || error.status !== 404) throw error
  try {
    await github<unknown>(`/repos/${owner}/${repo}/labels`, {
      method: 'POST',
      body: JSON.stringify({
        name: label,
        color: 'd73a4a',
        description: 'Does not meet contribution requirements'
      })
    })
  } catch (createError) {
    if (!(createError instanceof GitHubAPIError) || createError.status !== 422) throw createError
  }
}

await github<unknown>(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
  method: 'POST',
  body: JSON.stringify({ labels: [label] })
})

await github<unknown>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
  method: 'POST',
  body: JSON.stringify({
    body: 'Closing this as a low-effort PR because CodeRabbit failed the PR Hygiene check. See `CONTRIBUTING.md` and the PR template before opening a new PR. If you are sure this was closed by mistake, please file an issue with a link to this PR and the relevant context.'
  })
})

await github<unknown>(`/repos/${owner}/${repo}/pulls/${issueNumber}`, {
  method: 'PATCH',
  body: JSON.stringify({ state: 'closed' })
})
