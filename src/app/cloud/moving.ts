import { CalendarDate } from '@internationalized/date'

import { IS_BROWSER, IS_CLOUD_SITE, IS_TAURI, OFFICIAL_CLOUD_URL } from '@/constants'

/** The web app's old address, which moves to the official Cloud site's. */
const MOVING_ORIGIN = 'https://app.openpencil.dev'

/** The day the old address starts redirecting to the official Cloud site. */
export const CLOUD_MOVE_DAY = new CalendarDate(2026, 12, 20)

/** Whether `origin` is the web app's old address, in a browser build rather than Cloud's own. */
export function isMovingSite(origin: string): boolean {
  return IS_BROWSER && !IS_TAURI && !IS_CLOUD_SITE && origin === MOVING_ORIGIN
}

/**
 * The same page on the official Cloud site, which serves the same editor at the same addresses:
 * a room, a share link, an invitation, or the tour continues there.
 */
export function movedURL(page: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return new URL(`${page.pathname}${page.search}${page.hash}`, OFFICIAL_CLOUD_URL).href
}
