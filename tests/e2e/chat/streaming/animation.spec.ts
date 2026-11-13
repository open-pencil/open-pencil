import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('streaming words, lists, and code lines fade in and respect reduced motion and settled state', async ({
  page
}) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const fixture = await page.evaluateHandle(async () => {
    const vuePath = '/node_modules/.vite/deps/vue.js'
    const markdownPath = '/src/components/chat/ChatMarkdown.vue'
    const { createApp, h, ref, nextTick } = await import(vuePath)
    const { default: ChatMarkdown } = await import(markdownPath)
    const content = ref('A paragraph.\n\n- First item\n')
    const mode = ref('streaming')
    const host = document.createElement('div')
    host.dataset.slot = 'streaming-animation-fixture'
    document.body.append(host)
    const app = createApp(() => h(ChatMarkdown, { content: content.value, mode: mode.value }))
    app.mount(host)
    return {
      async append(text: string) {
        content.value += text
        await nextTick()
      },
      async settle() {
        mode.value = 'static'
        await nextTick()
      },
      dispose() {
        app.unmount()
        host.remove()
      }
    }
  })
  try {
    const markdown = page.locator('[data-slot="streaming-animation-fixture"]')
    const first = markdown.locator('li').first()
    await expect(first).toHaveCSS('animation-name', 'enter')
    await expect(markdown.locator('.markdown-word').first()).toHaveCSS('animation-name', 'enter')
    await fixture.evaluate((state) =>
      state.append('\n- Second item\n\n```typescript\nconst a = 1\n')
    )
    await expect(markdown.locator('li')).toHaveCount(2)
    const code = markdown.locator('[data-markdown="code-block"]')
    await expect(code).toBeVisible()
    await expect(code).toHaveCSS('animation-name', 'enter')
    const line = markdown.locator('pre .line').first()
    await expect(line).toHaveCSS('animation-name', 'enter')
    await fixture.evaluate((state) => state.append('const b = 2\n```'))
    await expect(code).toContainText('const b = 2')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(first).toHaveCSS('animation-name', 'none')
    await expect(line).toHaveCSS('animation-name', 'none')
    await fixture.evaluate((state) => state.settle())
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(first).toHaveCSS('animation-name', 'none')
    // The settled reply is plain text again, with no element per word.
    await expect(markdown.locator('.markdown-word')).toHaveCount(0)
    await expect(markdown.locator('[data-markdown="code-block"]')).toHaveCSS(
      'animation-name',
      'none'
    )
  } finally {
    await fixture.evaluate((state) => state.dispose())
    await fixture.dispose()
  }
})
