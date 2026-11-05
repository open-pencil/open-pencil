import { describe, expect, test } from 'bun:test'

import { serverUrl, token } from '@/app/integrations/shadr/store/state'
import { pageService } from '@/components/event-builder/services/page.service'

const testToken = process.env.SHADR_TOKEN

describe('Shadr Page Service Integration', () => {
  if (testToken) {
    token.value = testToken
  }
  if (process.env.SHADR_URL) {
    serverUrl.value = process.env.SHADR_URL
  }

  test.skipIf(!testToken)('list returns existing page ids', async () => {
    const pages = await pageService.list()
    expect(pages).toContain('main_menu')
    expect(pages).toContain('shop')
  })

  test.skipIf(!testToken)('get fetches main_menu page definition', async () => {
    const page = await pageService.get('main_menu')
    expect(page.name).toBe('main_menu')
    expect(page.screen.width).toBe(1920)
    expect(page.screen.height).toBe(1080)
    expect(page.blocks.length).toBeGreaterThan(0)
  })
})
