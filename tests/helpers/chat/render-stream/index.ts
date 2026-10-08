import type { Page } from '@playwright/test'

import type * as BrowserFixture from './browser'
import type { RenderStreamScenario } from './model'

/** Keep provider fixtures in a normally compiled module; only the test-module loader is serialized. */
export function installRenderStream(page: Page, scenario: RenderStreamScenario) {
  return page.evaluateHandle(async (scenario) => {
    const fixturePath = '/tests/helpers/chat/render-stream/browser.ts'
    const fixture: typeof BrowserFixture = await import(fixturePath)
    return fixture.installBrowserRenderStream(scenario)
  }, scenario)
}
