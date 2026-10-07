import { expect, test } from '@playwright/test'
import * as v from 'valibot'

const StoryIndex = v.object({
  entries: v.record(v.string(), v.object({ id: v.string(), type: v.string() }))
})

/** How long one story may take to render and run its play function. */
const STORY_TIMEOUT_MS = 20_000

// Storybook's index exists only once its server runs, after Playwright has collected tests,
// so one test walks every story and reports each failure separately.
test('every story renders and passes its play function', async ({ page, request }) => {
  const text = await (await request.get('/index.json')).text()
  const index = v.parse(v.pipe(v.string(), v.parseJson(), StoryIndex), text)
  const stories = Object.values(index.entries).filter((entry) => entry.type === 'story')
  test.setTimeout(stories.length * STORY_TIMEOUT_MS)
  expect(stories.length).toBeGreaterThan(0)

  for (const story of stories) {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`)
    const outcome = await page.evaluate(
      (timeout) =>
        new Promise<string>((resolve) => {
          const channel: unknown = Reflect.get(window, '__STORYBOOK_ADDONS_CHANNEL__')
          if (typeof channel !== 'object' || channel === null || !('on' in channel)) {
            resolve('Storybook channel is missing')
            return
          }
          const on = channel.on as (event: string, listener: (detail?: unknown) => void) => void
          // Exceptions name what failed. storyFinished comes last, after afterEach, and its
          // reporters say whether anything else failed; accessibility reports are left to axe.
          const failures: string[] = []
          const record = (kind: string) => (detail?: unknown) => {
            const message =
              detail instanceof Object && 'message' in detail ? detail.message : detail
            failures.push(`${kind}: ${String(message)}`)
          }
          on.call(channel, 'playFunctionThrewException', record('play function'))
          on.call(channel, 'storyThrewException', record('render'))
          on.call(channel, 'storyErrored', record('story'))
          on.call(channel, 'storyFinished', (detail?: unknown) => {
            const reporters =
              detail instanceof Object && 'reporters' in detail && Array.isArray(detail.reporters)
                ? detail.reporters
                : []
            for (const report of reporters) {
              const { type, status } = report as { type?: unknown; status?: unknown }
              if (type !== 'a11y' && status === 'failed')
                failures.push(`${String(type)} report failed`)
            }
            resolve(failures[0] ?? 'ok')
          })
          setTimeout(() => resolve('timed out'), timeout)
        }),
      STORY_TIMEOUT_MS
    )
    expect.soft(outcome, story.id).toBe('ok')
  }
})
