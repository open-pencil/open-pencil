import type { Page } from '@playwright/test'

/** Model the imported CANVAS metadata without loading a user document. */
export async function showImportedPageBackground(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('OpenPencil store not initialized')
    const canvas = editor.graph.addPage('Imported navy canvas')
    canvas.source.fig.rawNodeFields.backgroundColor = {
      r: 0.027450980618596077,
      g: 0.13725490868091583,
      b: 0.3529411852359772,
      a: 1
    }
    await editor.switchPage(canvas.id)
  })
}
