import * as v from 'valibot'

import { classifyAsset, latestStable, type Release, type Releases } from './releases'

declare const data: Releases
export { data }

const REPOSITORY_API = 'https://api.github.com/repos/open-pencil/open-pencil'
/** Enough to reach the latest stable release past the betas published after it. */
const RELEASES_PATH = '/releases?per_page=30'
/**
 * The rolling nightly pre-release (`tools/release/release-packages/src/nightly`), read by its tag
 * so it is found however far down the list it sits.
 */
const NIGHTLY_PATH = '/releases/tags/nightly'

const ReleaseSchema = v.object({
  tag_name: v.string(),
  html_url: v.string(),
  published_at: v.nullable(v.string()),
  draft: v.boolean(),
  prerelease: v.boolean(),
  assets: v.array(
    v.object({ name: v.string(), browser_download_url: v.string(), size: v.number() })
  )
})
type GitHubRelease = v.InferOutput<typeof ReleaseSchema>

/** A stalled response takes the same fallback as a failed one rather than hold up the build. */
const RELEASES_TIMEOUT_MS = 30_000

async function fetchGitHub<T>(
  path: string,
  schema: v.GenericSchema<unknown, T>
): Promise<T | null> {
  // CI passes the workflow's token; a local build without one stays within the anonymous limit.
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  try {
    const response = await fetch(`${REPOSITORY_API}${path}`, {
      headers: {
        accept: 'application/vnd.github+json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      signal: AbortSignal.timeout(RELEASES_TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
    const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
    if (!parsed.success) throw new Error('GitHub sent releases in an unexpected shape')
    return parsed.output
  } catch (error) {
    console.warn(
      `[download] ${path} unavailable, the page links to GitHub instead: ${String(error)}`
    )
    return null
  }
}

type PublishedRelease = GitHubRelease & { published_at: string }

function isPublished(release: GitHubRelease): release is PublishedRelease {
  return !release.draft && release.published_at !== null
}

/**
 * The latest stable release and the nightly, read from GitHub when the site is built, so the
 * download page is static: no request leaves the visitor's browser. A build that cannot reach
 * GitHub gives a page that links to the releases there instead.
 */
export default {
  async load(): Promise<Releases> {
    const [releases, nightly] = await Promise.all([
      fetchGitHub(RELEASES_PATH, v.array(ReleaseSchema)),
      fetchGitHub(NIGHTLY_PATH, ReleaseSchema)
    ])
    const stable = releases && latestStable(releases.filter(isPublished))
    const toRelease = (release: PublishedRelease): Release => ({
      version: release.tag_name.replace(/^v/, ''),
      date: release.published_at,
      url: release.html_url,
      files: release.assets.flatMap((asset) => {
        const file = classifyAsset({
          name: asset.name,
          url: asset.browser_download_url,
          size: asset.size
        })
        return file ? [file] : []
      }),
      checksums:
        release.assets.find((asset) => asset.name === 'SHA256SUMS')?.browser_download_url ?? null
    })
    return {
      stable: stable ? toRelease(stable) : null,
      nightly: nightly && isPublished(nightly) ? toRelease(nightly) : null
    }
  }
}
