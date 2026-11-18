import type { Page } from '@playwright/test'

/**
 * Turns the design-issue markers on or off through the same preference View → Design issues sets.
 * A fresh profile starts with them off, so specs that draw markers or Code tab underlines turn them
 * on first.
 */
export async function setDesignIssuesOnCanvas(page: Page, show: boolean) {
  await page.evaluate(async (enabled) => {
    const preferencesModule = '/src/app/settings/preferences/apply.ts'
    const { setDesignIssuesOnCanvas } = await import(preferencesModule)
    setDesignIssuesOnCanvas(enabled)
  }, show)
}
