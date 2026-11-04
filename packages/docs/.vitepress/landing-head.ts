import type { HeadConfig, TransformContext } from 'vitepress'

/**
 * The engine files a landing stage cannot render without. The page fetches them only after
 * its editor code arrives and a stage mounts, so without a hint they wait behind that code.
 * The faces are the ones the scenes use; the others load when a document asks for them.
 */
const ENGINE_ASSETS = [
  /\/canvaskit\.[\w-]+\.wasm$/,
  /\/Inter-Regular\.[\w-]+\.ttf$/,
  /\/Inter-Medium\.[\w-]+\.ttf$/,
  /\/Inter-SemiBold\.[\w-]+\.ttf$/,
  /\/Inter-Bold\.[\w-]+\.ttf$/
]

/**
 * Preloads the engine on pages that set `landing: true`, so CanvasKit and the fonts download
 * alongside the editor code instead of after it. Core and the font manager request them with
 * `fetch()`, so the hints are `as="fetch"` with CORS to share that request. Touch screens skip
 * them: there a stage starts only when the visitor asks for it.
 */
export function landingPreloads({ pageData, assets }: TransformContext): HeadConfig[] {
  if (pageData.frontmatter.landing !== true) return []
  return assets
    .filter((asset) => ENGINE_ASSETS.some((pattern) => pattern.test(asset)))
    .map((href): HeadConfig => [
      'link',
      { rel: 'preload', href, as: 'fetch', crossorigin: '', media: '(pointer: fine)' }
    ])
}
