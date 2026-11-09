import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

/** What a failure belongs to, so a retry reaches the same document and a newer save can clear it. */
export interface SaveFeedbackOptions {
  /** Identifies the document; a later successful save of it removes its failure. */
  key?: object
  /** Whether the document is still open, checked before retrying. */
  isOpen?: () => boolean
}

const failureToasts = new WeakMap<object, number>()

/**
 * Runs a save started by the person and reports a failure where they can see it. Saves started by
 * a room, an autosave, or the automation bridge keep their own error handling.
 */
export async function saveWithFeedback(
  save: () => Promise<unknown>,
  options: SaveFeedbackOptions = {}
): Promise<boolean> {
  try {
    const result = await save()
    if (options.key) {
      const failure = failureToasts.get(options.key)
      if (failure !== undefined) {
        toast.remove(failure)
        failureToasts.delete(options.key)
      }
    }
    return result !== false
  } catch (error) {
    const messages = notificationMessages.get()
    const id = toast.error(
      messages.operationFailed({ error: error instanceof Error ? error.message : String(error) }),
      {
        label: messages.saveFailedRetry,
        run: (toastId) => {
          toast.remove(toastId)
          if (options.key) failureToasts.delete(options.key)
          if (options.isOpen && !options.isOpen()) return
          void saveWithFeedback(save, options)
        }
      },
      { sticky: true }
    )
    if (options.key) failureToasts.set(options.key, id)
    return false
  }
}
