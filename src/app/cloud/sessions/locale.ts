import type { CloudPortalClient } from '@open-pencil/cloud/client'
import { locale } from '@open-pencil/vue/i18n'

/** The app's language, as a tag; Cloud writes email in it, or the nearest language it has. */
export function cloudLocale(): string {
  return locale.get()
}

/** An account on a server, which is told its language apart from any other. */
export type CloudLocaleAccount = { server: string; account: string }

const key = ({ server, account }: CloudLocaleAccount) => `${server}\n${account}`

/** The language each account was last told while the app runs. */
const told = new Map<string, string>()
/** Each account's report under way, which the next one waits for. */
const reports = new Map<string, Promise<void>>()

/**
 * Tells a server the app's language for an account, so its email reads like the app: once a run,
 * and again when the person changes language. Reports for one account go one at a time, each with
 * the language as it is when it goes, so the server ends with the last one. A server that can't
 * be told, as one from before it could, keeps writing as it did; the app doesn't ask it again
 * until the language changes.
 */
export function tellCloudLocale(
  account: CloudLocaleAccount,
  portal: Pick<CloudPortalClient, 'setLocale'>
): Promise<void> {
  const id = key(account)
  async function send() {
    const current = cloudLocale()
    if (told.get(id) === current) return
    await portal.setLocale(current).catch(() => undefined)
    told.set(id, current)
  }
  const report = (reports.get(id) ?? Promise.resolve()).then(send)
  reports.set(id, report)
  void report.finally(() => {
    if (reports.get(id) === report) reports.delete(id)
  })
  return report
}

/** Calls `changed` whenever the person picks another language. */
export function onCloudLocaleChange(changed: () => void): () => void {
  return locale.listen(changed)
}
