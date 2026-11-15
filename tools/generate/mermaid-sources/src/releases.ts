/** A `mermaid@x.y.z` tag's version as numbers, or null for another package's or a pre-release. */
export function releaseVersion(tag: string): number[] | null {
  const match = /^mermaid@(\d+)\.(\d+)\.(\d+)$/.exec(tag)
  return match ? match.slice(1).map(Number) : null
}

function newer(a: number[], b: number[]): boolean {
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

/**
 * The newest `mermaid@x.y.z` release in `git ls-remote --tags` output, with the commit it tags:
 * an annotated tag's `^{}` line names the commit, its own line the tag object.
 */
export function newestRelease(lsRemote: string): { tag: string; commit: string } | null {
  const commits = new Map<string, string>()
  for (const line of lsRemote.split('\n')) {
    const [sha, ref] = line.split('\t')
    if (!sha || !ref.startsWith('refs/tags/')) continue
    const name = ref.slice('refs/tags/'.length)
    if (name.endsWith('^{}')) commits.set(name.slice(0, -3), sha)
    else if (!commits.has(name)) commits.set(name, sha)
  }
  let best: { tag: string; commit: string; version: number[] } | null = null
  for (const [tag, commit] of commits) {
    const version = releaseVersion(tag)
    if (version && (!best || newer(version, best.version))) best = { tag, commit, version }
  }
  return best && { tag: best.tag, commit: best.commit }
}

/** Mermaid's latest release, from the tags in its repository. */
export function latestRelease(): { tag: string; commit: string } {
  const listed = Bun.spawnSync([
    'git',
    'ls-remote',
    '--tags',
    'https://github.com/mermaid-js/mermaid',
    'refs/tags/mermaid@*'
  ])
  if (!listed.success) throw new Error(`git ls-remote: ${listed.stderr.toString()}`)
  const latest = newestRelease(listed.stdout.toString())
  if (!latest) throw new Error('Mermaid has no mermaid@x.y.z tag')
  return latest
}
