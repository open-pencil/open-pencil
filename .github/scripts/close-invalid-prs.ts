import { readFile } from 'node:fs/promises'

const owner = process.env.GITHUB_REPOSITORY_OWNER
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const eventPath = process.env.GITHUB_EVENT_PATH
const token = process.env.GITHUB_TOKEN

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

const hygieneFailed = /PR Hygiene/i.test(text) && /(fail|failed|error|❌|request changes|changes requested)/i.test(text)
if (!hygieneFailed) {
  console.log('CodeRabbit signal did not reference a failed PR Hygiene check.')
  process.exit(0)
}

async function github<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
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
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${body}`)
  }

  if (response.status === 204) return null as T
  return response.json() as Promise<T>
}

const pr = await github<PullRequestResponse>(`/repos/${owner}/${repo}/pulls/${issueNumber}`)
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
  const message = error instanceof Error ? error.message : String(error)
  if (!message.includes('404')) throw error
  await github<unknown>(`/repos/${owner}/${repo}/labels`, {
    method: 'POST',
    body: JSON.stringify({
      name: label,
      color: 'd73a4a',
      description: 'Does not meet contribution requirements'
    })
  })
}

await github<unknown>(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
  method: 'POST',
  body: JSON.stringify({ labels: [label] })
})

await github<unknown>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
  method: 'POST',
  body: JSON.stringify({
    body: 'Closing this as invalid because CodeRabbit failed the PR Hygiene check. See `CONTRIBUTING.md` and the PR template before opening a new PR.'
  })
})

await github<unknown>(`/repos/${owner}/${repo}/pulls/${issueNumber}`, {
  method: 'PATCH',
  body: JSON.stringify({ state: 'closed' })
})
