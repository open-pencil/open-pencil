import { computed } from 'vue'

import { appPreferences, updateNotificationPreferences } from '@/app/settings/preferences/store'

import type { NotificationEvent } from '.'

/** Whether `event` sends a notification, as a model for its switch in Settings. */
export function notificationPreference(event: NotificationEvent) {
  return computed({
    get: () => appPreferences.value.notifications[event],
    set: (enabled: boolean) => updateNotificationPreferences({ [event]: enabled })
  })
}
