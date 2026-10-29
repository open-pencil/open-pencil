import type { SiteFiles } from '#cloud/runtime/site/server'

/** The built site's files from the Worker's static assets. */
export function assetSiteFiles(assets: Fetcher): SiteFiles {
  return async (path, request) => {
    const file = await assets.fetch(new URL(path, request.url))
    if (!file.ok || !file.body) return null
    return {
      body: file.body,
      type: file.headers.get('Content-Type') ?? 'application/octet-stream'
    }
  }
}
