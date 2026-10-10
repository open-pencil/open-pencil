import { expect, test, type Page } from '@playwright/test'
import * as v from 'valibot'

const StoryIndex = v.object({
  entries: v.record(v.string(), v.object({ id: v.string(), type: v.string() }))
})

/** How long one story may take to render and run its play function. */
const STORY_TIMEOUT_MS = 20_000

/** Each story is checked in both app themes, since their tokens meet contrast separately. */
const THEMES = ['dark', 'light'] as const

/** How many tests share the stories, so workers can check them side by side. */
const SHARDS = 4

/** Where the outcome the init script collects for the open story waits to be read. */
const OUTCOME_KEY = '__openPencilStoryOutcome'

// Storybook's index exists only once its server runs, after Playwright has collected tests,
// so a fixed number of tests each take every SHARDS-th story and report each failure separately.
for (let shard = 0; shard < SHARDS; shard++) {
  test(`stories render, pass their play functions, and meet axe in both themes (${shard + 1}/${SHARDS})`, async ({
    page,
    request
  }) => {
    const text = await (await request.get('/index.json')).text()
    const index = v.parse(v.pipe(v.string(), v.parseJson(), StoryIndex), text)
    const stories = Object.values(index.entries)
      .filter((entry) => entry.type === 'story')
      .filter((_, position) => position % SHARDS === shard)
    test.setTimeout(stories.length * THEMES.length * STORY_TIMEOUT_MS)
    expect(stories.length).toBeGreaterThan(0)
    await page.addInitScript(watchStoryOutcome, { key: OUTCOME_KEY, timeout: STORY_TIMEOUT_MS })

    for (const theme of THEMES) {
      for (const story of stories) {
        await page.goto(`/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`)
        expect.soft(await storyOutcome(page), `${story.id} (${theme})`).toBe('ok')
      }
    }
  })
}

/**
 * Runs before Storybook's own scripts on every page, so the outcome is heard even when a story
 * finishes before `goto` returns: it listens on Storybook's channel the moment Storybook sets it,
 * and leaves 'ok', or the first failure the story reports, in a promise under `key`.
 */
function watchStoryOutcome({ key, timeout }: { key: string; timeout: number }) {
  const outcome = new Promise<string>((resolve) => {
    // Exceptions name what failed. storyFinished comes last, after afterEach, and its
    // reporters say whether anything else failed, axe's naming the rules it found broken.
    const failures: string[] = []
    const record = (kind: string) => (detail?: unknown) => {
      const message = detail instanceof Object && 'message' in detail ? detail.message : detail
      failures.push(`${kind}: ${String(message)}`)
    }
    const listen = (channel: unknown) => {
      if (typeof channel !== 'object' || channel === null || !('on' in channel)) return
      const on = channel.on as (event: string, listener: (detail?: unknown) => void) => void
      on.call(channel, 'playFunctionThrewException', record('play function'))
      on.call(channel, 'storyThrewException', record('render'))
      on.call(channel, 'storyErrored', record('story'))
      on.call(channel, 'storyFinished', (detail?: unknown) => {
        const reporters =
          detail instanceof Object && 'reporters' in detail && Array.isArray(detail.reporters)
            ? detail.reporters
            : []
        for (const report of reporters) {
          const { type, status, result } = report as {
            type?: unknown
            status?: unknown
            result?: { violations?: { id: string; nodes: { target: unknown }[] }[] }
          }
          if (status !== 'failed') continue
          const violations = (result?.violations ?? []).map(
            (violation) =>
              `${violation.id} at ${violation.nodes.map((node) => String(node.target)).join(', ')}`
          )
          failures.push(
            `${String(type)} report failed${violations.length ? `: ${violations.join('; ')}` : ''}`
          )
        }
        resolve(failures[0] ?? 'ok')
      })
    }
    let channel: unknown
    Object.defineProperty(window, '__STORYBOOK_ADDONS_CHANNEL__', {
      configurable: true,
      get: () => channel,
      set: (value: unknown) => {
        channel = value
        listen(value)
      }
    })
    setTimeout(() => resolve('timed out'), timeout)
  })
  Reflect.set(window, key, outcome)
}

/** 'ok', or the first failure the open story reports. */
function storyOutcome(page: Page): Promise<string> {
  return page.evaluate(async (key) => {
    const outcome: unknown = Reflect.get(window, key)
    return outcome instanceof Promise ? String(await outcome) : 'Story outcome was not watched'
  }, OUTCOME_KEY)
}
