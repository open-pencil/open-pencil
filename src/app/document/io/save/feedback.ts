import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

/**
 * Runs a save started by the person and reports a failure where they can see it. Saves started by
 * a room, an autosave, or the automation bridge keep their own error handling.
 */
export async function saveWithFeedback(save: () => Promise<unknown>): Promise<boolean> {
  try {
    return (await save()) !== false
  } catch (error) {
    toast.error(
      notificationMessages
        .get()
        .operationFailed({ error: error instanceof Error ? error.message : String(error) })
    )
    return false
  }
}
