import { translationsLoading } from '@nanostores/i18n'

import { localeSetting, type Locale } from '@open-pencil/vue/i18n'

import { notificationMessages } from '@/app/i18n/notifications'

/** Load the real asynchronous notification catalog and restore the caller's locale afterward. */
export async function withNotificationLocale(code: Locale, run: () => Promise<void>) {
  const previous = localeSetting.get()
  const unbind = notificationMessages.subscribe(() => undefined)
  try {
    localeSetting.set(code)
    await translationsLoading(notificationMessages.i18n)
    await run()
  } finally {
    localeSetting.set(previous)
    await translationsLoading(notificationMessages.i18n)
    unbind()
  }
}
