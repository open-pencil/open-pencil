import * as v from 'valibot'

declare const data: { stars: number | null }
export { data }

const REPOSITORY_URL = 'https://api.github.com/repos/open-pencil/open-pencil'

const repositorySchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ stargazers_count: v.pipe(v.number(), v.integer(), v.minValue(0)) })
)

/** A stalled response takes the same fallback as a failed one rather than hold up the build. */
const REPOSITORY_TIMEOUT_MS = 30_000

/**
 * The repository's stars, read from GitHub when the site is built, for the header's GitHub
 * button; a build that can't reach GitHub shows the button without a count.
 */
export default {
  async load(): Promise<{ stars: number | null }> {
    // CI passes the workflow's token; a local build without one stays within the anonymous limit.
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
    try {
      const response = await fetch(REPOSITORY_URL, {
        headers: {
          accept: 'application/vnd.github+json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        signal: AbortSignal.timeout(REPOSITORY_TIMEOUT_MS)
      })
      if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
      const parsed = v.safeParse(repositorySchema, await response.text())
      if (!parsed.success) throw new Error('GitHub sent the repository in an unexpected shape')
      return { stars: parsed.output.stargazers_count }
    } catch (error) {
      console.warn(`[header] Stars unavailable, the GitHub button shows none: ${String(error)}`)
      return { stars: null }
    }
  }
}
