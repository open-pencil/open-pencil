import * as v from 'valibot'
import { createMarkdownRenderer } from 'vitepress'

import { classifyAsset, latestReleases, type Release, type Releases } from './releases'

declare const data: Releases
export { data }

const RELEASES_URL = 'https://api.github.com/repos/open-pencil/open-pencil/releases?per_page=30'

const ReleaseSchema = v.object({
  tag_name: v.string(),
  html_url: v.string(),
  published_at: v.nullable(v.string()),
  draft: v.boolean(),
  prerelease: v.boolean(),
  body: v.nullable(v.string()),
  assets: v.array(
    v.object({ name: v.string(), browser_download_url: v.string(), size: v.number() })
  )
})
type GitHubRelease = v.InferOutput<typeof ReleaseSchema>

const ReleasesResponse = v.pipe(v.string(), v.parseJson(), v.array(ReleaseSchema))

/** A stalled response takes the same fallback as a failed one rather than hold up the build. */
const RELEASES_TIMEOUT_MS = 30_000

async function fetchReleases(): Promise<GitHubRelease[] | null> {
  // CI passes the workflow's token; a local build without one stays within the anonymous limit.
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  try {
    const response = await fetch(RELEASES_URL, {
      headers: {
        accept: 'application/vnd.github+json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      signal: AbortSignal.timeout(RELEASES_TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
    const parsed = v.safeParse(ReleasesResponse, await response.text())
    if (!parsed.success) throw new Error('GitHub sent releases in an unexpected shape')
    return parsed.output
  } catch (error) {
    console.warn(
      `[download] Releases unavailable, the page links to GitHub instead: ${String(error)}`
    )
    return null
  }
}

/**
 * The latest stable release and any newer beta, read from GitHub when the site is built, so the
 * download page is static: no request leaves the visitor's browser. A build that cannot reach
 * GitHub gives a page that links to the releases there instead.
 */
export default {
  async load(): Promise<Releases> {
    const releases = await fetchReleases()
    if (!releases) return { stable: null, beta: null }
    const published = releases.filter(
      (release): release is GitHubRelease & { published_at: string } =>
        !release.draft && release.published_at !== null
    )
    const { stable, beta } = latestReleases(published)
    const markdown = await createMarkdownRenderer(process.cwd())
    const toRelease = (
      release: GitHubRelease & { published_at: string },
      notes = false
    ): Release => ({
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
        release.assets.find((asset) => asset.name === 'SHA256SUMS')?.browser_download_url ?? null,
      // Only the beta shows its notes; the stable release links to them on GitHub.
      notes: notes ? markdown.render(release.body ?? '') : ''
    })
    return {
      stable: stable ? toRelease(stable) : null,
      beta: beta ? toRelease(beta, true) : null
    }
  }
}
