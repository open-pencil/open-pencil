import type { Page } from '@playwright/test'

const FONT_MODULE_RESOURCE_CAPACITY = 4096

/** Preserve the loaded font module URL even when the dev module graph exceeds the browser's default buffer. */
export async function trackFontModuleResources(page: Page): Promise<void> {
  await page.addInitScript(
    (capacity) => performance.setResourceTimingBufferSize(capacity),
    FONT_MODULE_RESOURCE_CAPACITY
  )
}
