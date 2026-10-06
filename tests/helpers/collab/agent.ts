import type { Page } from '@playwright/test'

import type * as AgentFixture from './agent-browser'

/** Start an agent in the peer's browser; returns its callsign and page. */
export function startAgent(page: Page, pageName: string, x: number, y: number) {
  return page.evaluate(
    async ({ pageName, x, y }) => {
      const fixturePath = '/tests/helpers/collab/agent-browser.ts'
      const fixture: typeof AgentFixture = await import(fixturePath)
      return fixture.startTestAgent(pageName, x, y)
    },
    { pageName, x, y }
  )
}
