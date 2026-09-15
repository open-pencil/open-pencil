import type { Page } from '@playwright/test'

export function probeParagraphBuilds(page: Page) {
  return page.evaluateHandle(() => {
    const renderers = window.openPencil?.getStore?.().canvasRenderers
    if (!renderers?.length) throw new Error('Renderer unavailable')
    const restores: Array<() => void> = []
    const counts = { builds: 0, readiness: 0 }
    for (const builder of new Set(renderers.map((renderer) => renderer.ck.ParagraphBuilder))) {
      const original = builder.MakeFromFontProvider
      builder.MakeFromFontProvider = (...args) => {
        counts.builds++
        return original.apply(builder, args)
      }
      restores.push(() => {
        builder.MakeFromFontProvider = original
      })
    }
    for (const renderer of renderers) {
      const original = renderer.nodeFontReadiness
      renderer.nodeFontReadiness = (node) => {
        counts.readiness++
        return original.call(renderer, node)
      }
      restores.push(() => {
        renderer.nodeFontReadiness = original
      })
    }
    return {
      count: () => counts.builds,
      readiness: () => counts.readiness,
      restore: () => {
        for (const restore of restores) restore()
      }
    }
  })
}
