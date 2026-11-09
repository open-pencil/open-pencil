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
    const messages = notificationMessages.get()
    toast.error(
      messages.operationFailed({ error: error instanceof Error ? error.message : String(error) }),
      {
        label: messages.saveFailedRetry,
        run: (toastId) => {
          toast.remove(toastId)
          void saveWithFeedback(save)
        }
      },
      { sticky: true }
    )
    return false
  }
}
