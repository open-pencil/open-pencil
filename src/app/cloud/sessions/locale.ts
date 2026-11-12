import type { CloudPortalClient } from '@open-pencil/cloud/client'
import { isCloudLocale, type CloudLocale } from '@open-pencil/cloud/contract'
import { locale } from '@open-pencil/vue/i18n'

/** The app's language, which Cloud writes email in; every language the app has, Cloud has. */
export function cloudLocale(): CloudLocale {
  const current = locale.get()
  return isCloudLocale(current) ? current : 'en'
}

/** The language each server was last told, by its ID, while the app runs. */
const told = new Map<string, CloudLocale>()

/**
 * Tells a server the app's language, so its email reads like the app: once a run for each
 * account, and again when the person changes language. A server that can't be told, as one from
 * before it could, keeps writing as it did; the app doesn't ask it again until the language changes.
 */
export async function tellCloudLocale(
  serverId: string,
  portal: Pick<CloudPortalClient, 'setLocale'>
): Promise<void> {
  const current = cloudLocale()
  if (told.get(serverId) === current) return
  told.set(serverId, current)
  await portal.setLocale(current).catch(() => undefined)
}

/** Forgets what a server was told, so the account signed in next is told again. */
export function forgetCloudLocale(serverId: string): void {
  told.delete(serverId)
}

/** Calls `changed` whenever the person picks another language. */
export function onCloudLocaleChange(changed: () => void): () => void {
  return locale.listen(changed)
}
