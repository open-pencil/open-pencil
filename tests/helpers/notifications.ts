import type { Page } from '@playwright/test'
import * as v from 'valibot'

const shownSchema = v.array(v.object({ title: v.string(), body: v.string(), tag: v.string() }))

/**
 * Replaces the browser's notifications, before the app reads their permission, with allowed ones
 * that are only recorded with how many closed. `notification-click` clicks the last one. Call it
 * before the page loads the app.
 */
export async function recordNotifications(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shown: { title: string; body: string; tag: string }[] = []
    class RecordedNotification extends EventTarget {
      static readonly permission = 'granted'
      static async requestPermission() {
        return 'granted'
      }
      constructor(title: string, options: NotificationOptions = {}) {
        super()
        shown.push({ title, body: options.body ?? '', tag: options.tag ?? '' })
        document.documentElement.dataset.notifications = JSON.stringify(shown)
        const index = shown.length - 1
        document.addEventListener('notification-click', () => {
          if (index === shown.length - 1) this.dispatchEvent(new Event('click'))
        })
      }
      close() {
        const closed = Number(document.documentElement.dataset.closedNotifications ?? 0)
        document.documentElement.dataset.closedNotifications = String(closed + 1)
        this.dispatchEvent(new Event('close'))
      }
    }
    Object.defineProperty(window, 'Notification', { value: RecordedNotification })
  })
}

/** Takes focus from the window, as switching to another app does, or gives it back. */
export async function setWindowFocus(page: Page, focused: boolean): Promise<void> {
  await page.evaluate((type) => window.dispatchEvent(new Event(type)), focused ? 'focus' : 'blur')
}

/** The notifications shown so far, oldest first. */
export async function shownNotifications(page: Page) {
  const json = await page.evaluate(() => document.documentElement.dataset.notifications ?? '[]')
  return v.parse(v.pipe(v.string(), v.parseJson(), shownSchema), json)
}
