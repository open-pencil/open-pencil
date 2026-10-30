import { watch } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'
import { randomInt } from '@open-pencil/scene-graph/random'

import { appPreferences, type NotificationPreferences } from '@/app/settings/preferences/store'
import { activeTab, getActiveTabId } from '@/app/tabs'

import { browserNotificationPermission } from './permission'

/** Each kind of event a notification reports, named by the preference that turns it on. */
export type NotificationEvent = keyof NotificationPreferences

export interface AppNotification {
  event: NotificationEvent
  title: string
  body: string
  /** The tab the event happened in; it is shown when the notification is clicked. */
  tabId: string | null
  /**
   * In browsers a newer notification with the same tag replaces an older one that is still shown.
   * The desktop shell cannot replace or remove one on macOS and Windows, so each stays.
   */
  tag: string
  /** Shows what the notification is about, after the window comes forward. */
  open: () => void
}

/**
 * Notifications the desktop shell showed, by id, kept to open them when clicked. macOS and Windows
 * do not report a dismissed one, so only the latest are kept; an older one brings the window
 * forward when clicked, as the system does for any notification of the app.
 */
const shownOnDesktop = new Map<number, () => void>()
const DESKTOP_CLICKS_KEPT = 50
/** Browser notifications still shown, with their tab, closed once the person sees that tab. */
const shownInBrowser = new Map<Notification, string | null>()
let desktopClicks: Promise<void> | null = null
let closesOnReturn = false

/** The person is looking at this tab of the focused window, so a notification would only repeat it. */
function isWatching(tabId: string | null): boolean {
  if (document.visibilityState !== 'visible' || !document.hasFocus()) return false
  return tabId === null || tabId === getActiveTabId()
}

async function focusDesktopWindow(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const window = getCurrentWindow()
  await window.unminimize()
  await window.setFocus()
}

/**
 * Clicks reach the shell only for notifications shown after a listener exists, so it is added
 * before the first one. Windows reports a click only while the toast is on screen, not once it
 * moved to the Action Center.
 */
async function addDesktopClickListener(): Promise<void> {
  const { onAction } = await import('@tauri-apps/plugin-notification')
  await onAction(({ actionId, notification }) => {
    const id = notification?.id
    const open = id === undefined ? undefined : shownOnDesktop.get(id)
    if (actionId !== 'tap' || !open || id === undefined) return
    shownOnDesktop.delete(id)
    void focusDesktopWindow().finally(open)
  })
}

function listenForDesktopClicks(): Promise<void> {
  // A listener that could not be added is tried again with the next notification.
  desktopClicks ??= addDesktopClickListener().catch((error: unknown) => {
    desktopClicks = null
    throw error
  })
  return desktopClicks
}

async function showOnDesktop(notification: AppNotification): Promise<void> {
  await listenForDesktopClicks()
  const { sendNotification } = await import('@tauri-apps/plugin-notification')
  const id = randomInt()
  shownOnDesktop.set(id, notification.open)
  for (const old of shownOnDesktop.keys()) {
    if (shownOnDesktop.size <= DESKTOP_CLICKS_KEPT) break
    shownOnDesktop.delete(old)
  }
  sendNotification({ id, title: notification.title, body: notification.body })
}

function closeShownForActiveTab(): void {
  if (!document.hasFocus()) return
  const activeTabId = getActiveTabId()
  for (const [open, tabId] of shownInBrowser)
    if (tabId === null || tabId === activeTabId) open.close()
}

function showInBrowser(notification: AppNotification): void {
  if (browserNotificationPermission.value !== 'granted') return
  let shown: Notification
  try {
    shown = new Notification(notification.title, {
      body: notification.body,
      tag: notification.tag
    })
  } catch {
    // Mobile browsers show notifications only through a service worker and throw here.
    return
  }
  if (!closesOnReturn) {
    closesOnReturn = true
    // What a notification reports is in view once the focused window shows its tab, so it no
    // longer needs one; those about other tabs stay to be clicked.
    window.addEventListener('focus', closeShownForActiveTab)
    watch(() => activeTab.value?.id, closeShownForActiveTab)
  }
  shownInBrowser.set(shown, notification.tabId)
  shown.addEventListener('close', () => shownInBrowser.delete(shown))
  shown.addEventListener('click', () => {
    window.focus()
    shown.close()
    notification.open()
  })
}

/**
 * Sends a system notification for `event` when its preference is on and the person is away:
 * the window is hidden or unfocused, or shows another tab. Browsers show it only once the person
 * allowed notifications; the desktop shell always may, unless the system settings turned them off.
 */
export function notify(notification: AppNotification): void {
  if (!appPreferences.value.notifications[notification.event]) return
  if (isWatching(notification.tabId)) return
  if (IS_TAURI)
    void showOnDesktop(notification).catch((error) =>
      console.warn('[Notifications] Not shown:', error)
    )
  else showInBrowser(notification)
}
