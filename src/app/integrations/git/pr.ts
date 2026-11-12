/** The remote a project pushes to, split into the parts a compare link needs. */
export type RemoteLocation = {
  host: string
  owner: string
  repo: string
}

const SCP_STYLE = /^(?:ssh:\/\/)?git@(?<host>[^:/]+)[:/](?<path>.+?)(?:\.git)?\/?$/i
const URL_STYLE = /^(?:https?|git):\/\/(?:[^@/]+@)?(?<host>[^/]+)\/(?<path>.+?)(?:\.git)?\/?$/i

/**
 * The owner and repository a git remote names, from the two forms remotes are written in:
 * `git@github.com:owner/repo.git` and `https://github.com/owner/repo.git`, with or without the
 * `.git` suffix. A remote this app cannot read answers null rather than a guessed path.
 */
export function parseRemoteURL(url: string): RemoteLocation | null {
  const trimmed = url.trim()
  const found = SCP_STYLE.exec(trimmed) ?? URL_STYLE.exec(trimmed)
  const host = found?.groups?.host
  const path = found?.groups?.path
  if (host === undefined || path === undefined) return null
  const segments = path.split('/').filter((segment) => segment !== '')
  if (segments.length < 2) return null
  const repo = segments.at(-1)
  const owner = segments.at(-2)
  if (repo === undefined || owner === undefined) return null
  return { host, owner, repo }
}

/**
 * Whether a remote is one this app opens pull requests on. `gh pr create` and the comparison page
 * both follow GitHub's own addresses, so a remote on another host — GitLab, Gitea, a bare server —
 * gets neither instead of a link built for a path layout it may not share.
 */
export function isGitHubRemote(remote: RemoteLocation): boolean {
  return remote.host.toLowerCase() === 'github.com'
}

/**
 * The page a pull request is opened from: the comparison between the branch that would be pushed
 * and the branch it would land in. The link needs no token, and the person opens it signed in
 * with whatever account the browser already holds.
 */
export function compareURL(remote: RemoteLocation, base: string, head: string): string {
  const { host, owner, repo } = remote
  return `https://${host}/${owner}/${repo}/compare/${base}...${head}?expand=1`
}
