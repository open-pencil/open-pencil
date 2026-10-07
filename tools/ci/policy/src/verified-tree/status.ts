/**
 * A pull request's CI records the tree it verified as a commit status on the PR head. When the
 * merge queue later tests a commit with exactly that tree, nothing has changed since the PR's
 * CI passed, so the queue can rely on it instead of running every check again.
 */
export const VERIFIED_TREE_CONTEXT = 'CI verified tree'

const SHA = /^[a-f0-9]{40}$/
/** The workflow whose passing pull request runs may vouch for a tree. */
const CI_WORKFLOW = '.github/workflows/ci.yml'
const ACTIONS_BOT = 'github-actions[bot]'

export interface GitHubAccess {
  repository: string
  token: string
  fetch?: typeof fetch
}

async function github(
  access: GitHubAccess,
  path: string,
  init: RequestInit = {}
): Promise<unknown> {
  const response = await (access.fetch ?? fetch)(
    `https://api.github.com/repos/${access.repository}${path}`,
    {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${access.token}`,
        'x-github-api-version': '2022-11-28',
        ...init.headers
      }
    }
  )
  if (!response.ok) throw new Error(`GitHub ${path} answered ${response.status}`)
  const body: unknown = await response.json()
  return body
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined
}

/** The pull request a merge queue branch tests, `gh-readonly-queue/<base>/pr-<number>-<sha>`. */
export function queuedPullRequest(headRef: string): number | undefined {
  const match = /^(?:refs\/heads\/)?gh-readonly-queue\/.+\/pr-(\d+)-[a-f0-9]{40}$/.exec(headRef)
  return match ? Number(match[1]) : undefined
}

/** Whether the queued pull request's own CI already passed on exactly `tree`. */
export async function isVerifiedTree(
  access: GitHubAccess,
  headRef: string,
  tree: string
): Promise<boolean> {
  const pullRequest = queuedPullRequest(headRef)
  if (pullRequest === undefined || !SHA.test(tree)) return false
  const head = field(field(await github(access, `/pulls/${pullRequest}`), 'head'), 'sha')
  if (typeof head !== 'string' || !SHA.test(head)) return false
  const statuses = await github(access, `/commits/${head}/statuses?per_page=100`)
  if (!Array.isArray(statuses)) return false
  // Newest first: only the latest record for this context counts.
  const latest = statuses.find((status) => field(status, 'context') === VERIFIED_TREE_CONTEXT)
  if (field(latest, 'state') !== 'success' || field(latest, 'description') !== tree) return false
  return vouchedByRun(access, latest, head)
}

/**
 * A record counts only when GitHub shows it came from a passing CI run on this pull request's
 * head: Actions wrote it, and its target is that run. Anyone with write access can post a status,
 * and another pull request's CI could post one here; neither is such a run.
 */
async function vouchedByRun(access: GitHubAccess, status: unknown, head: string): Promise<boolean> {
  if (field(field(status, 'creator'), 'login') !== ACTIONS_BOT) return false
  const target = field(status, 'target_url')
  const runId = typeof target === 'string' ? runIdFromURL(access.repository, target) : undefined
  if (runId === undefined) return false
  const run = await github(access, `/actions/runs/${runId}`)
  return (
    field(run, 'path') === CI_WORKFLOW &&
    field(run, 'event') === 'pull_request' &&
    field(run, 'conclusion') === 'success' &&
    field(run, 'head_sha') === head
  )
}

/** The run id in `https://github.com/<repository>/actions/runs/<id>`, for this repository only. */
function runIdFromURL(repository: string, url: string): string | undefined {
  const prefix = `https://github.com/${repository}/actions/runs/`
  if (!url.startsWith(prefix)) return undefined
  const [id] = url.slice(prefix.length).split('/')
  return id && /^\d+$/.test(id) ? id : undefined
}

/** Records on the PR head that the CI run `runURL` passed on `tree`. */
export async function recordVerifiedTree(
  access: GitHubAccess,
  head: string,
  tree: string,
  runURL: string
): Promise<void> {
  if (!SHA.test(head) || !SHA.test(tree)) throw new Error('Invalid head or tree SHA')
  if (runIdFromURL(access.repository, runURL) === undefined) throw new Error('Invalid run URL')
  await github(access, `/statuses/${head}`, {
    method: 'POST',
    body: JSON.stringify({
      state: 'success',
      context: VERIFIED_TREE_CONTEXT,
      description: tree,
      target_url: runURL
    })
  })
}
