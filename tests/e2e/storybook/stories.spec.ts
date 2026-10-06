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
          const fail = (kind: string) => (detail?: unknown) =>
            resolve(
              `${kind}: ${detail instanceof Object && 'message' in detail ? String(detail.message) : String(detail)}`
            )
          on.call(channel, 'storyRendered', () => resolve('ok'))
          on.call(channel, 'playFunctionThrewException', fail('play function'))
          on.call(channel, 'storyThrewException', fail('render'))
          on.call(channel, 'storyErrored', fail('story'))
          setTimeout(() => resolve('timed out'), timeout)
        }),
      STORY_TIMEOUT_MS
    )
    expect.soft(outcome, story.id).toBe('ok')
  }
})
