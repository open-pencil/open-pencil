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
  title: string
  user: { login: string }
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

function prHygieneFailureName(line: string): string | null {
  const cells = tableCells(line)
  const checkName = cells[0] ?? ''
  const status = cells[1] ?? ''
  if (checkName.toLowerCase().includes('[ignored]')) return null
  if (!normalizedCheckName(checkName).startsWith('pr hygiene')) return null
  if (!/❌/u.test(status) && !/\berror\b/i.test(status)) return null

  return checkName
}

const hygieneFailures = text.split('\n').map(prHygieneFailureName).filter((name): name is string => Boolean(name))

if (hygieneFailures.length === 0) {
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
    throw new GitHubAPIError(
      `${options.method ?? 'GET'} ${path} failed: ${response.status} ${body}`,
      response.status
    )
  }

  if (response.status === 204) return null
  return response.json() as Promise<T>
}

const pr = await github<PullRequestResponse>(`/repos/${owner}/${repo}/pulls/${issueNumber}`)
if (!pr) throw new Error(`PR #${issueNumber} returned no data`)

console.log(
  [
    `Detected CodeRabbit PR Hygiene failure on #${issueNumber}: ${hygieneFailures.join(', ')}`,
    `Author: ${pr.user.login} (${pr.author_association})`,
    `Title: ${pr.title}`,
    'No automatic close/label/comment was applied. Treat this as maintainer review signal only.'
  ].join('\n')
)
