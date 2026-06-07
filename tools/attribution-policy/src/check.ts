import { readFile } from 'node:fs/promises'

const FORBIDDEN_TEXT_PATTERNS = [
  /co-authored-by:\s*(?:claude|cursor|(?:github\s+)?copilot|opencode)/i,
  /generated\s+(?:with|by)\s+(?:claude\s+code|cursor|(?:github\s+)?copilot|opencode)/i,
  /made\s+with\s+cursor/i,
  /🤖\s*generated\s+with/i
]

const FORBIDDEN_CLAUDE_CONFIG_PATTERNS = [/^\.claude\//, /\.claude\/(?:\*\*)?/]

export type PullRequestPolicyInput = {
  title: string
  body: string
  commitMessages: string[]
  changedFiles: string[]
}

export type PolicyViolation = {
  location: string
  message: string
}

type GitHubPullRequestEvent = {
  pull_request?: {
    number?: number
    title?: string
    body?: string | null
    commits_url?: string
    url?: string
    issue_url?: string
  }
  repository?: {
    full_name?: string
  }
}

type GitHubCommit = {
  commit?: {
    message?: string
  }
}

type GitHubFile = {
  filename?: string
}

function hasForbiddenText(value: string) {
  return FORBIDDEN_TEXT_PATTERNS.some((pattern) => pattern.test(value))
}

function hasForbiddenClaudeConfig(value: string) {
  return FORBIDDEN_CLAUDE_CONFIG_PATTERNS.some((pattern) => pattern.test(value))
}

export function findPolicyViolations(input: PullRequestPolicyInput): PolicyViolation[] {
  const violations: PolicyViolation[] = []

  if (hasForbiddenText(input.title)) {
    violations.push({
      location: 'PR title',
      message:
        'Remove coding-harness branding from the PR title; review-relevant model identifiers are allowed.'
    })
  }

  if (hasForbiddenText(input.body)) {
    violations.push({
      location: 'PR body',
      message:
        'Remove coding-harness branding from the PR body; review-relevant model identifiers are allowed.'
    })
  }

  for (const [index, message] of input.commitMessages.entries()) {
    if (!hasForbiddenText(message)) continue
    violations.push({
      location: `commit ${index + 1}`,
      message:
        'Remove coding-harness attribution or branding from the commit message; review-relevant model identifiers are allowed.'
    })
  }

  for (const file of input.changedFiles) {
    if (!hasForbiddenClaudeConfig(file)) continue
    violations.push({
      location: file,
      message: 'Do not commit vendor-specific Claude Code project configuration.'
    })
  }

  return violations
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function githubJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${requireEnv('GITHUB_TOKEN')}`,
      'x-github-api-version': '2022-11-28'
    }
  })

  if (!response.ok)
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`)
  return (await response.json()) as T
}

function apiURL(path: string) {
  return `https://api.github.com${path}`
}

async function githubArrayPages<T>(path: string): Promise<T[]> {
  const items: T[] = []

  for (let page = 1; ; page += 1) {
    const pageItems = await githubJSON<T[]>(apiURL(`${path}?per_page=100&page=${page}`))
    items.push(...pageItems)
    if (pageItems.length < 100) return items
  }
}

async function inputFromGitHubEvent(eventPath: string): Promise<PullRequestPolicyInput> {
  const event = JSON.parse(await readFile(eventPath, 'utf8')) as GitHubPullRequestEvent
  const pullRequest = event.pull_request
  const repo = event.repository?.full_name
  const number = pullRequest?.number
  if (!pullRequest || !repo || !number)
    throw new Error('This check only supports pull request events')

  const commits = await githubArrayPages<GitHubCommit>(`/repos/${repo}/pulls/${number}/commits`)
  const files = await githubArrayPages<GitHubFile>(`/repos/${repo}/pulls/${number}/files`)

  return {
    title: pullRequest.title ?? '',
    body: pullRequest.body ?? '',
    commitMessages: commits.map((commit) => commit.commit?.message ?? ''),
    changedFiles: files.map((file) => file.filename ?? '')
  }
}

async function main() {
  const input = await inputFromGitHubEvent(requireEnv('GITHUB_EVENT_PATH'))
  const violations = findPolicyViolations(input)
  if (violations.length === 0) return

  console.error('AI-tool attribution/product-placement policy failed.\n')
  for (const violation of violations) {
    console.error(`- ${violation.location}: ${violation.message}`)
  }
  console.error(
    '\nOpenPencil welcomes contributors using any coding tools. If AI context is useful for review, mention the model identifier without advertising the coding harness; repository history and config are project metadata, not vendor advertising space.'
  )
  process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
